/**
 * POST /api/memory/extract
 *
 * Background endpoint called after a chat session to extract memories.
 * Uses Gemini structured output to extract facts in JSON format.
 * Saves results to Firestore via the memory injector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { Message, CharacterData } from '@/types';
import {
  MEMORY_EXTRACTION_SCHEMA,
  MEMORY_EXTRACTION_SYSTEM,
  isValidMemoryExtraction,
} from '@/lib/memory/schema';
import { extractResponseText } from '@/lib/gemini/response-text';
import { saveMemory } from '@/lib/memory/injector';

const MEMORY_MODEL = 'gemini-2.0-flash';  // cheaper model for extraction

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const { messages, characterData, uid, sessionId } = await req.json() as {
      messages: Message[];
      characterData: CharacterData;
      uid: string;
      sessionId: string;
    };

    if (!messages?.length || !characterData || !uid || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build conversation transcript for extraction
    const transcript = messages
      .filter((m) => m.text?.trim())
      .map((m) => `${m.character ? characterData.name : 'User'}: ${m.text}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: MEMORY_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze this conversation and extract structured memory facts.\n\nCharacter: ${characterData.name} (${characterData.profession})\n\nConversation:\n${transcript}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: MEMORY_EXTRACTION_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: MEMORY_EXTRACTION_SCHEMA,
        temperature: 0.1, // deterministic for extraction
      },
    });

    const rawText = extractResponseText(response);
    if (!rawText) {
      return NextResponse.json({ extracted: 0 });
    }

    const extracted = JSON.parse(rawText);

    if (!isValidMemoryExtraction(extracted)) {
      return NextResponse.json({ error: 'Invalid extraction schema' }, { status: 422 });
    }

    // Persist to Firestore
    await saveMemory(uid, characterData.id!, sessionId, extracted);

    return NextResponse.json({
      extracted: extracted.sessionFacts.length + extracted.characterInsights.length,
      updatedPreferences: extracted.shouldUpdatePreferences,
    });
  } catch (error: any) {
    console.error('[memory/extract] Error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
