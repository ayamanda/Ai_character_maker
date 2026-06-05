import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
  type Part,
} from '@google/genai';
import { CharacterData, Message, SSEEvent } from '@/types';
import { getToolDeclarations, executeTool } from '@/lib/tools/registry';
import { getOrCreatePersonaCache } from '@/lib/cache/persona-cache';
import { buildSystemInstruction } from '@/lib/buildSystemInstruction';
import { extractResponseText } from '@/lib/gemini/response-text';

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17';
const ENABLE_TOOLS = process.env.ENABLE_TOOLS !== 'false'; // opt-out via env
const MAX_TOOL_ROUNDS = 5; // guard against infinite loops

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// ─── Safety Settings ─────────────────────────────────────────────────────────

const CHAT_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// ─── SSE Helpers ──────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function encodeSSE(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const abortController = new AbortController();
  req.signal.addEventListener('abort', () => abortController.abort());

  try {
    const body = await req.json() as {
      userMessage: string;
      characterData: CharacterData;
      messages: Message[];
      enableTools?: boolean;
      turnId?: string;
    };

    const { userMessage, characterData, messages, enableTools, turnId: _turnId } = body;

    if (!userMessage || !characterData) {
      return NextResponse.json(
        { error: 'Missing required fields: userMessage, characterData' },
        { status: 400 }
      );
    }

    const systemInstruction = buildSystemInstruction(characterData);
    const useTools = ENABLE_TOOLS && (enableTools !== false);

    // Try to get/create a persona cache for this character (Phase 5)
    // Falls back to null gracefully if below token threshold or API fails.
    const cachedContent = await getOrCreatePersonaCache(characterData).catch(() => null);

    // Build initial conversation history
    const conversationHistory: Content[] = messages
      .filter((msg) => msg.text?.trim())
      .map((msg): Content => ({
        role: msg.character ? 'model' : 'user',
        parts: [{ text: msg.text }],
      }));

    conversationHistory.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // ── Streaming ReadableStream ──────────────────────────────────────────────

    const readable = new ReadableStream({
      async start(controller) {
        const enqueue = (event: SSEEvent) => {
          if (!abortController.signal.aborted) {
            controller.enqueue(encodeSSE(event));
          }
        };

        try {
          enqueue({ type: 'status', state: 'thinking' });

          // ── Agentic loop: model → tool → model (max MAX_TOOL_ROUNDS) ───────
          let history: Content[] = [...conversationHistory];
          let promptTokens = 0;
          let completionTokens = 0;
          let cachedTokens = 0;
          let toolRound = 0;

          while (toolRound <= MAX_TOOL_ROUNDS) {
            if (abortController.signal.aborted) {
              enqueue({ type: 'status', state: 'cancelled' });
              controller.close();
              return;
            }

            // ── Step 1: Initial generateContent (non-streaming for tool detection) ──
            if (useTools && toolRound === 0) {
              const nonStreamResp = await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents: history,
                config: {
                  // Use cached persona if available, otherwise use systemInstruction directly
                  ...(cachedContent ? { cachedContent } : { systemInstruction }),
                  temperature: 0.7,
                  safetySettings: CHAT_SAFETY_SETTINGS,
                  tools: [{ functionDeclarations: getToolDeclarations() }],
                },
              });

              // Capture token usage
              if (nonStreamResp.usageMetadata) {
                promptTokens += nonStreamResp.usageMetadata.promptTokenCount ?? 0;
                completionTokens += nonStreamResp.usageMetadata.candidatesTokenCount ?? 0;
                cachedTokens += nonStreamResp.usageMetadata.cachedContentTokenCount ?? 0;
              }

              const candidate = nonStreamResp.candidates?.[0];
              const functionCalls = candidate?.content?.parts?.filter(
                (p: Part) => p.functionCall
              );

              if (functionCalls && functionCalls.length > 0) {
                // ── Step 2: Execute tool calls ────────────────────────────────
                enqueue({ type: 'status', state: 'tool-running' });

                // Append model's tool-call message to history
                history.push({
                  role: 'model',
                  parts: candidate!.content!.parts,
                });

                const functionResponseParts: Part[] = [];

                for (const part of functionCalls) {
                  const callId = part.functionCall!.id ?? `call-${Date.now()}`;
                  const name = part.functionCall!.name!;
                  const args = (part.functionCall!.args ?? {}) as Record<string, unknown>;

                  enqueue({
                    type: 'tool_call',
                    callId,
                    name,
                    args,
                  });

                  const toolStart = Date.now();
                  const result = await executeTool(name, args, { characterData });
                  const durationMs = Date.now() - toolStart;

                  enqueue({
                    type: 'tool_result',
                    callId,
                    name,
                    result,
                    durationMs,
                  });

                  functionResponseParts.push({
                    functionResponse: {
                      id: callId,
                      name,
                      response: { result },
                    },
                  });
                }

                // Append tool results to history
                history.push({ role: 'user', parts: functionResponseParts });
                toolRound++;
                // Loop again to get final text response
                continue;
              }

              // No tool calls — stream the text response directly
              // Fall through to streaming below
            }

            // ── Step 3: Stream the final text response ─────────────────────────
            enqueue({ type: 'status', state: 'responding' });

            const streamResp = await ai.models.generateContentStream({
              model: GEMINI_MODEL,
              contents: history,
              config: {
                // Use cached persona if available, otherwise use systemInstruction directly
                ...(cachedContent ? { cachedContent } : { systemInstruction }),
                temperature: 0.7,
                safetySettings: CHAT_SAFETY_SETTINGS,
                // No tool declarations on final streaming pass to avoid more calls
              },
            });

            for await (const chunk of streamResp) {
              if (abortController.signal.aborted) {
                enqueue({ type: 'status', state: 'cancelled' });
                controller.close();
                return;
              }

              const delta = extractResponseText(chunk);
              if (delta) {
                enqueue({ type: 'content', delta });
              }

              if (chunk.usageMetadata) {
                promptTokens += chunk.usageMetadata.promptTokenCount ?? 0;
                completionTokens += chunk.usageMetadata.candidatesTokenCount ?? 0;
                cachedTokens += chunk.usageMetadata.cachedContentTokenCount ?? 0;
              }
            }

            // Done with text streaming
            break;
          }

          enqueue({ type: 'status', state: 'done' });
          enqueue({
            type: 'meta',
            promptTokens,
            completionTokens,
            cachedTokens,
            durationMs: Date.now() - startTime,
          });

          controller.close();
        } catch (error: any) {
          if (abortController.signal.aborted || error?.name === 'AbortError') {
            enqueue({ type: 'status', state: 'cancelled' });
            controller.close();
            return;
          }

          console.error('[chat/route] Stream error:', error);

          const isSafetyBlock =
            error?.message?.includes('SAFETY') || error?.message?.includes('blocked');

          enqueue({
            type: 'error',
            message: isSafetyBlock
              ? 'Response blocked by safety filters. Try rephrasing your message.'
              : 'An error occurred while generating the response.',
            code: isSafetyBlock ? 'SAFETY_BLOCK' : 'STREAM_ERROR',
          });
          enqueue({ type: 'status', state: 'error' });
          controller.close();
        }
      },

      cancel() {
        abortController.abort();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('[chat/route] Unhandled error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
