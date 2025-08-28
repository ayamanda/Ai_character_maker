'use client';

import React, { useEffect } from 'react';
import { useAdminAuth, hasAdminLevel } from '@/lib/adminAuth';

export interface AdminRouteGuardProps {
  children: React.ReactNode;
  requiredLevel?: 'super' | 'moderator' | 'support';
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function AdminRouteGuard({
  children,
  requiredLevel = 'support',
  fallback,
  redirectTo = '/',
}: AdminRouteGuardProps) {
  const { user, isAdmin, adminLevel, isBlocked, loading } = useAdminAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin || isBlocked || !hasAdminLevel(adminLevel, requiredLevel))) {
      if (redirectTo && typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
    }
  }, [user, isAdmin, adminLevel, isBlocked, loading, requiredLevel, redirectTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user || !isAdmin || isBlocked || !hasAdminLevel(adminLevel, requiredLevel)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            {!user 
              ? 'You must be logged in to access this page.'
              : isBlocked
              ? 'Your account has been blocked.'
              : 'You do not have permission to access this page.'
            }
          </p>
          <a
            href={redirectTo}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go Back
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}