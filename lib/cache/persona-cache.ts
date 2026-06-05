/**
 * lib/cache/persona-cache.ts
 *
 * Context cache manager for character system instructions (Phase 5).
 *
 * Uses Gemini implicit caching by default. Explicit caching can be enabled for
 * large persona contexts with GEMINI_ENABLE_EXPLICIT_CACHE=true.
 *
 * Per docs: Gemini 2.5 Flash also has implicit caching enabled by default,
 * which means even without explicit caching, common prefixes are cached
 * automatically. This explicit cache is for guaranteed cost savings.
 */

import { GoogleGenAI } from '@google/genai';
import { CharacterData } from '@/types';
import { buildSystemInstruction } from '@/lib/buildSystemInstruction';

const CACHE_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17';
const CACHE_TTL = '3600s'; // 1 hour
const CACHE_SKIP_TTL_MS = 55 * 60 * 1000;

export const MIN_EXPLICIT_CACHE_TOKENS = 1024;

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  return ai;
}

// In-process cache name map: characterId → Gemini cache name
// (In production, store this in Redis or Firestore for multi-instance support)
const activeCacheNames = new Map<string, { name: string; expiresAt: number }>();
const explicitCacheSkips = new Map<string, number>();

export function shouldCreateExplicitPersonaCache(tokenCount: number | undefined): boolean {
  return (tokenCount ?? 0) >= MIN_EXPLICIT_CACHE_TOKENS;
}

export function isExplicitPersonaCacheEnabled(
  value = process.env.GEMINI_ENABLE_EXPLICIT_CACHE
): boolean {
  return value === 'true';
}

// ─── Get or create cache ──────────────────────────────────────────────────────

export async function getOrCreatePersonaCache(
  characterData: CharacterData
): Promise<string | null> {
  const charId = characterData.id;
  if (!charId) return null;
  if (!isExplicitPersonaCacheEnabled()) return null;

  // Check in-memory map first
  const cached = activeCacheNames.get(charId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.name;
  }

  const skipUntil = explicitCacheSkips.get(charId);
  if (skipUntil && skipUntil > Date.now()) {
    return null;
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = buildSystemInstruction(characterData);
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `(Session start) Hello, I'm beginning a new conversation with ${characterData.name}.`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: `Hello! I'm ${characterData.name}. ${
              characterData.description
                ? characterData.description.slice(0, 200)
                : 'Ready to chat!'
            }`,
          },
        ],
      },
    ];

    const tokenCount = await ai.models.countTokens({
      model: CACHE_MODEL,
      contents,
      config: { systemInstruction },
    });

    if (!shouldCreateExplicitPersonaCache(tokenCount.totalTokens)) {
      explicitCacheSkips.set(charId, Date.now() + CACHE_SKIP_TTL_MS);
      return null;
    }

    const cache = await ai.caches.create({
      model: CACHE_MODEL,
      config: {
        systemInstruction,
        ttl: CACHE_TTL,
        displayName: `persona-${charId}`,
        contents,
      },
    });

    const cacheName = cache.name;
    if (!cacheName) throw new Error('Cache name was undefined');

    // Store with 55min TTL (5min buffer before actual expiry)
    activeCacheNames.set(charId, {
      name: cacheName,
      expiresAt: Date.now() + 55 * 60 * 1000,
    });

    return cacheName;
  } catch (err: any) {
    // Cache creation can fail if content is below minimum token count for the model
    // In that case, fall back to uncached (implicit caching still helps on Gemini 2.5)
    console.warn(
      `[persona-cache] Could not create explicit cache for ${charId}:`,
      err?.message?.slice(0, 120)
    );
    return null;
  }
}

// ─── Invalidate cache for a character ────────────────────────────────────────

export async function invalidatePersonaCache(characterId: string): Promise<void> {
  const cached = activeCacheNames.get(characterId);
  explicitCacheSkips.delete(characterId);
  if (!cached) return;

  activeCacheNames.delete(characterId);
  try {
    await getGeminiClient().caches.delete({ name: cached.name });
  } catch {
    // Ignore deletion errors (cache may have already expired)
  }
}
