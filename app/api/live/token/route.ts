/**
 * POST /api/live/token
 *
 * Mints a short-lived ephemeral token for the Gemini Live API.
 * The system instruction is locked into the token server-side —
 * the client never sees the API key or the system prompt.
 *
 * Security model (from official Gemini docs):
 *  1. Client authenticates with our backend (Firebase ID token)
 *  2. Backend mints a single-use ephemeral token from Gemini
 *  3. Token is sent to client; client uses it like an API key for Live WebSocket
 *  4. Token expires in 30 min (session) / 1 min to start (new session)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import { buildSystemInstruction } from '@/lib/buildSystemInstruction';
import { CharacterData } from '@/types';

// Separate model for Live voice sessions — independent from the chat model
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.0-flash-live-001';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  // Ephemeral tokens require v1alpha
  httpOptions: { apiVersion: 'v1alpha' },
});

// ─── Auth helper (uses Firebase REST API — no Admin SDK required) ─────────────

async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  try {
    // Try Firebase Admin first if available
    const { adminAuth } = await import('@/lib/firebase-admin');
    if (adminAuth) {
      const decoded = await adminAuth.verifyIdToken(idToken);
      return decoded.uid;
    }
  } catch {
    // Admin SDK not configured — fall through to REST verification
  }

  try {
    // Fallback: verify via Firebase Auth REST API (public endpoint, no service account needed)
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return null;

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const user = data.users?.[0];
    return user?.localId ?? null;
  } catch {
    return null;
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { characterData, idToken } = await req.json() as {
      characterData: CharacterData;
      idToken: string;
    };

    // Verify the caller is authenticated
    if (!idToken) {
      return NextResponse.json({ error: 'Missing id token' }, { status: 401 });
    }

    const uid = await verifyFirebaseToken(idToken);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!characterData) {
      return NextResponse.json({ error: 'Missing characterData' }, { status: 400 });
    }

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString(); // 1 min

    // System instruction is LOCKED in the token — never exposed to client
    const systemInstruction = buildSystemInstruction(characterData);

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return NextResponse.json({
      token: token.name,
      model: LIVE_MODEL,
      systemInstruction,
      expiresAt: expireTime,
    });
  } catch (error: any) {
    console.error('[live/token] Error minting ephemeral token:', error);
    return NextResponse.json(
      { error: 'Failed to create live session token', details: error?.message },
      { status: 500 }
    );
  }
}
