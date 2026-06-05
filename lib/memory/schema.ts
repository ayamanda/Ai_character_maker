/**
 * lib/memory/schema.ts
 *
 * Structured output schema for memory extraction (Phase 4).
 * The Gemini API will return JSON conforming to this schema
 * after each conversation turn.
 */

import { MemoryExtractionResult } from '@/types';

/**
 * JSON Schema (OpenAPI subset) for memory extraction.
 * Passed as `responseSchema` to Gemini with `responseMimeType: 'application/json'`.
 */
export const MEMORY_EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sessionFacts: {
      type: 'ARRAY',
      description: 'Facts learned about the user during this session',
      items: {
        type: 'OBJECT',
        properties: {
          fact: {
            type: 'STRING',
            description: 'The extracted fact about the user',
          },
          confidence: {
            type: 'NUMBER',
            description: 'Confidence score from 0 to 1',
          },
          category: {
            type: 'STRING',
            enum: ['preference', 'personal_info', 'topic', 'emotion'],
            description: 'Category of the fact',
          },
        },
        required: ['fact', 'confidence', 'category'],
      },
    },
    characterInsights: {
      type: 'ARRAY',
      description: 'Insights about how the user relates to this character',
      items: {
        type: 'OBJECT',
        properties: {
          characterId: {
            type: 'STRING',
            description: 'The character ID this insight relates to',
          },
          insight: {
            type: 'STRING',
            description: 'The insight about the user-character relationship',
          },
          sentiment: {
            type: 'STRING',
            enum: ['positive', 'negative', 'neutral'],
          },
        },
        required: ['characterId', 'insight', 'sentiment'],
      },
    },
    shouldUpdatePreferences: {
      type: 'BOOLEAN',
      description: 'Whether long-term user preferences should be updated based on this session',
    },
  },
  required: ['sessionFacts', 'characterInsights', 'shouldUpdatePreferences'],
};

/** System prompt for the memory extractor */
export const MEMORY_EXTRACTION_SYSTEM = `You are a memory extraction assistant. Your task is to analyze a conversation between a user and an AI character, and extract structured facts about the user.

Extract:
1. sessionFacts: Things the user revealed about themselves, their preferences, emotions, or topics they care about
2. characterInsights: How the user relates to the character they are talking to
3. shouldUpdatePreferences: Set true if the user expressed strong preferences that should be remembered long-term

Be conservative — only extract clear, confident facts. Do not infer overly specific things. Assign confidence scores honestly (0.9+ = very clear statement, 0.5 = implied, <0.5 = skip it).`;

/** Type guard for extracted memory */
export function isValidMemoryExtraction(obj: unknown): obj is MemoryExtractionResult {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as any;
  return (
    Array.isArray(r.sessionFacts) &&
    Array.isArray(r.characterInsights) &&
    typeof r.shouldUpdatePreferences === 'boolean'
  );
}
