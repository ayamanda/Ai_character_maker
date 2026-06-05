/**
 * POST /api/observability
 *
 * Lightweight observability endpoint for tracking per-turn metrics:
 * - First-token latency (time to first chunk)
 * - Cache hit rates (cachedTokens / promptTokens)
 * - Tool call success rates
 * - Stream state outcomes
 *
 * Called fire-and-forget from the client after each turn completes.
 * Writes to Firestore: users/{uid}/observability/{turnId}
 *
 * GET /api/observability?uid=... returns aggregate stats (admin use).
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { TurnMetrics } from '@/types';

// ─── POST — record a turn's metrics ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      // Gracefully degrade if Firebase Admin isn't configured
      return NextResponse.json({ ok: true, skipped: 'admin-sdk-unavailable' });
    }

    const metrics = (await req.json()) as TurnMetrics & { uid: string };

    if (!metrics.uid || !metrics.turnId || !metrics.sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { uid, ...turnData } = metrics;

    // Write turn metrics to Firestore
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('observability')
      .doc(metrics.turnId)
      .set({
        ...turnData,
        // Derived stats
        cacheHitRate:
          metrics.promptTokens > 0
            ? Math.round((metrics.cachedTokens / metrics.promptTokens) * 100) / 100
            : 0,
        toolSuccessRate:
          metrics.toolCallCount > 0
            ? Math.round((metrics.toolSuccessCount / metrics.toolCallCount) * 100) / 100
            : null,
        createdAt: new Date().toISOString(),
      });

    // Update session aggregate stats
    const sessionRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('chatSessions')
      .doc(metrics.sessionId);

    const sessionSnap = await sessionRef.get();
    if (sessionSnap.exists) {
      const existing = sessionSnap.data() as Record<string, any>;
      await sessionRef.update({
        totalTokens:
          (existing.totalTokens ?? 0) + metrics.promptTokens + metrics.completionTokens,
        cacheHitTokens: (existing.cacheHitTokens ?? 0) + metrics.cachedTokens,
        avgFirstTokenMs: existing.avgFirstTokenMs
          ? Math.round((existing.avgFirstTokenMs + metrics.firstTokenMs) / 2)
          : metrics.firstTokenMs,
        turnCount: (existing.turnCount ?? 0) + 1,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[observability] POST error:', error);
    return NextResponse.json({ error: 'Failed to record metrics' }, { status: 500 });
  }
}

// ─── GET — fetch recent turn metrics for a user ───────────────────────────────

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Admin SDK not available' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const limitCount = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('observability')
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const turns = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data(),
    }));

    // Aggregate summary
    const totalTurns = turns.length;
    const avgFirstToken =
      totalTurns > 0
        ? Math.round(
            turns.reduce((s: number, t: any) => s + (t.firstTokenMs ?? 0), 0) / totalTurns
          )
        : 0;
    const avgCacheHit =
      totalTurns > 0
        ? Math.round(
            (turns.reduce((s: number, t: any) => s + (t.cacheHitRate ?? 0), 0) / totalTurns) * 100
          ) / 100
        : 0;
    const errorRate =
      totalTurns > 0
        ? Math.round(
            (turns.filter((t: any) => t.streamState === 'error').length / totalTurns) * 100
          ) / 100
        : 0;

    return NextResponse.json({
      turns,
      summary: {
        totalTurns,
        avgFirstTokenMs: avgFirstToken,
        avgCacheHitRate: avgCacheHit,
        errorRate,
      },
    });
  } catch (error: any) {
    console.error('[observability] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
