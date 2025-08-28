// app/api/admin/audit-trail/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminActionLogs } from '@/lib/admin';
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const adminId = searchParams.get('adminId');
    const action = searchParams.get('action');
    const targetType = searchParams.get('targetType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get audit trail data
    const auditLogs = await getAdminActionLogs(limit);
    
    // Apply filters
    let filteredLogs = auditLogs;
    
    if (adminId) {
      filteredLogs = filteredLogs.filter(log => log.adminId === adminId);
    }
    
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action.includes(action));
    }
    
    if (targetType) {
      filteredLogs = filteredLogs.filter(log => log.targetType === targetType);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      filteredLogs = filteredLogs.filter(log => log.timestamp >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      filteredLogs = filteredLogs.filter(log => log.timestamp <= end);
    }

    // Generate summary statistics
    const summary = {
      totalActions: filteredLogs.length,
      uniqueAdmins: new Set(filteredLogs.map(log => log.adminId)).size,
      actionTypes: Object.entries(
        filteredLogs.reduce((acc, log) => {
          acc[log.action] = (acc[log.action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort(([,a], [,b]) => (b as number) - (a as number)),
      targetTypes: Object.entries(
        filteredLogs.reduce((acc, log) => {
          acc[log.targetType] = (acc[log.targetType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort(([,a], [,b]) => (b as number) - (a as number)),
      timeRange: filteredLogs.length > 0 ? {
        earliest: Math.min(...filteredLogs.map(log => log.timestamp.getTime())),
        latest: Math.max(...filteredLogs.map(log => log.timestamp.getTime())),
      } : null,
    };

    return NextResponse.json({
      success: true,
      auditLogs: filteredLogs,
      summary,
      filters: {
        limit,
        adminId,
        action,
        targetType,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error('Audit trail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    );
  }
}