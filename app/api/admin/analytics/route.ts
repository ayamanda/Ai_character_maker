// app/api/admin/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSystemAnalytics, logAdminActionEnhanced } from '@/lib/admin';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and check admin status
    const decodedToken = await adminAuth.verifyIdToken(token);
    const customClaims = decodedToken as any;
    
    if (!customClaims.admin || customClaims.blocked) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get analytics data
    const analytics = await getSystemAnalytics();
    
    // Log the analytics access
    await logAdminActionEnhanced(
      decodedToken.uid,
      decodedToken.email || 'unknown',
      'view_analytics',
      'system',
      'analytics',
      'Accessed system analytics dashboard',
      { timestamp: new Date().toISOString() },
      'low'
    );

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and check admin status
    const decodedToken = await adminAuth.verifyIdToken(token);
    const customClaims = decodedToken as any;
    
    if (!customClaims.admin || customClaims.blocked) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetType, targetId, reason, details } = body;

    // Log custom admin action
    await logAdminActionEnhanced(
      decodedToken.uid,
      decodedToken.email || 'unknown',
      action,
      targetType,
      targetId,
      reason,
      details || {},
      'medium'
    );

    return NextResponse.json({
      success: true,
      message: 'Action logged successfully',
    });
  } catch (error) {
    console.error('Analytics logging error:', error);
    return NextResponse.json(
      { error: 'Failed to log action' },
      { status: 500 }
    );
  }
}