// app/api/admin/set-claims/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { uid, isAdmin, adminLevel, isBlocked } = await request.json();
    
    // Verify the request is from an authorized source
    // In production, you'd want proper authentication here
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { adminAuth, isAdminSDKAvailable, getInitializationError } = await import(
      '@/lib/firebase-admin'
    );

    if (!isAdminSDKAvailable()) {
      const initError = getInitializationError();
      return NextResponse.json(
        {
          error: 'Firebase Admin SDK not configured',
          details: initError,
        },
        { status: 500 }
      );
    }
    
    // Set custom claims
    await adminAuth.setCustomUserClaims(uid, {
      admin: isAdmin,
      adminLevel: adminLevel || 'support',
      blocked: isBlocked || false,
      blockExpiry: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting custom claims:', error);
    return NextResponse.json({ error: 'Failed to set claims' }, { status: 500 });
  }
}
