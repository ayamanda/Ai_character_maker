/**
 * lib/memory/injector.ts
 *
 * Retrieves relevant memory from Firestore and injects into system prompts.
 * Layered memory architecture:
 *   - Session:     users/{uid}/memory/session         (short-term, current session)
 *   - Character:   users/{uid}/memory/character/{cid}  (mid-term, per character)
 *   - Preferences: users/{uid}/memory/preferences      (long-term, global)
 */

import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  MemoryFact,
  CharacterInsight,
  MemoryExtractionResult,
  CharacterData,
} from '@/types';

// ─── Read memory ──────────────────────────────────────────────────────────────

interface AllMemory {
  sessionFacts: MemoryFact[];
  characterFacts: MemoryFact[];
  preferences: MemoryFact[];
  characterInsights: CharacterInsight[];
}

export async function loadMemory(
  uid: string,
  characterId: string
): Promise<AllMemory> {
  const results: AllMemory = {
    sessionFacts: [],
    characterFacts: [],
    preferences: [],
    characterInsights: [],
  };

  try {
    // Session memory (last 10 facts, high relevance only)
    const sessionRef = collection(db, `users/${uid}/memory/session/facts`);
    const sessionSnap = await getDocs(
      query(sessionRef, orderBy('createdAt', 'desc'), limit(10))
    );
    results.sessionFacts = sessionSnap.docs
      .map((d) => d.data() as MemoryFact)
      .filter((f) => f.confidence >= 0.6);

    // Character-specific memory
    const charRef = collection(
      db,
      `users/${uid}/memory/character/${characterId}/facts`
    );
    const charSnap = await getDocs(
      query(charRef, orderBy('createdAt', 'desc'), limit(8))
    );
    results.characterFacts = charSnap.docs
      .map((d) => d.data() as MemoryFact)
      .filter((f) => f.confidence >= 0.5);

    // Long-term preferences
    const prefDoc = await getDoc(
      doc(db, `users/${uid}/memory/preferences`)
    );
    if (prefDoc.exists()) {
      results.preferences = (prefDoc.data().facts ?? []) as MemoryFact[];
    }

    // Character insights
    const insightRef = collection(
      db,
      `users/${uid}/memory/character/${characterId}/insights`
    );
    const insightSnap = await getDocs(
      query(insightRef, orderBy('createdAt', 'desc'), limit(5))
    );
    results.characterInsights = insightSnap.docs.map(
      (d) => d.data() as CharacterInsight
    );
  } catch (err) {
    console.warn('[memory/injector] Failed to load memory:', err);
  }

  return results;
}

// ─── Build memory context string ──────────────────────────────────────────────

export function buildMemoryContext(memory: AllMemory, characterName: string): string {
  const sections: string[] = [];

  if (memory.preferences.length > 0) {
    sections.push(
      '**User Long-term Preferences:**\n' +
      memory.preferences.map((f) => `- ${f.fact}`).join('\n')
    );
  }

  if (memory.characterFacts.length > 0) {
    sections.push(
      `**Past interactions with ${characterName}:**\n` +
      memory.characterFacts.map((f) => `- ${f.fact}`).join('\n')
    );
  }

  if (memory.characterInsights.length > 0) {
    sections.push(
      `**User's relationship with ${characterName}:**\n` +
      memory.characterInsights.map((i) => `- ${i.insight}`).join('\n')
    );
  }

  if (memory.sessionFacts.length > 0) {
    sections.push(
      '**This session — user revealed:**\n' +
      memory.sessionFacts.map((f) => `- ${f.fact} (${f.category})`).join('\n')
    );
  }

  if (sections.length === 0) return '';

  return `\n\n---\n**Memory Context (use this to personalise responses):**\n\n${sections.join('\n\n')}`;
}

// ─── Write memory after extraction ───────────────────────────────────────────

export async function saveMemory(
  uid: string,
  characterId: string,
  sessionId: string,
  extracted: MemoryExtractionResult
): Promise<void> {
  try {
    // Save session facts
    for (const fact of extracted.sessionFacts) {
      const ref = doc(
        collection(db, `users/${uid}/memory/session/facts`)
      );
      await setDoc(ref, { ...fact, sessionId, createdAt: serverTimestamp() });
    }

    // Save character facts (from session facts that are character-specific)
    const charFacts = extracted.sessionFacts.filter((f) =>
      f.category === 'preference' || f.category === 'emotion'
    );
    for (const fact of charFacts) {
      const ref = doc(
        collection(db, `users/${uid}/memory/character/${characterId}/facts`)
      );
      await setDoc(ref, { ...fact, createdAt: serverTimestamp() });
    }

    // Save character insights
    for (const insight of extracted.characterInsights) {
      const ref = doc(
        collection(db, `users/${uid}/memory/character/${characterId}/insights`)
      );
      await setDoc(ref, { ...insight, createdAt: serverTimestamp() });
    }

    // Update long-term preferences if flagged
    if (extracted.shouldUpdatePreferences) {
      const prefRef = doc(db, `users/${uid}/memory/preferences`);
      const existing = await getDoc(prefRef);
      const existingFacts: MemoryFact[] = existing.exists()
        ? (existing.data().facts ?? [])
        : [];
      // Merge new high-confidence facts
      const newHigh = extracted.sessionFacts.filter(
        (f) => f.confidence >= 0.8 && f.category === 'preference'
      );
      const merged = [...existingFacts, ...newHigh].slice(-20); // keep last 20
      await setDoc(prefRef, { facts: merged, updatedAt: serverTimestamp() });
    }
  } catch (err) {
    console.warn('[memory/injector] Failed to save memory:', err);
  }
}
