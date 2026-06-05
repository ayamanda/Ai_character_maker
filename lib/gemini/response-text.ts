import type { GenerateContentResponse } from '@google/genai';

type ResponseWithCandidates = Pick<GenerateContentResponse, 'candidates'>;

export function extractResponseText(response: ResponseWithCandidates): string | undefined {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let text = '';
  let hasVisibleText = false;

  for (const part of parts) {
    if (part.thought) continue;
    if (typeof part.text !== 'string') continue;

    hasVisibleText = true;
    text += part.text;
  }

  return hasVisibleText ? text : undefined;
}
