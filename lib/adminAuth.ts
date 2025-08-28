// lib/adminAuth.ts
'use client';

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';
import { isUserAdmin, getUserAdminLevel, isUserBlocked, updateLastLogin } from './admin';
import { trackUserLogin } from './analytics';

export interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  adminLevel: 'super' | 'moderator' | 'support' | null;
  isBlocked: boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for admin authentication state
 */
export function useAdminAuth(): AdminAuthState {
  const [user, loading, error] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLevel, setAdminLevel] = useState<'super' | 'moderator' | 'support' | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      if (loading) return;
      
      setAdminLoading(true);
      
      if (user) {
        try {
          const [adminStatus, level, blocked] = await Promise.all([
            isUserAdmin(user),
            getUserAdminLevel(user),
            isUserBlocked(user),
          ]);
          
          setIsAdmin(adminStatus);
          setAdminLevel(level);
          setIsBlocked(blocked);
          
          // Create/update admin user document if user is admin and not blocked
          if (adminStatus && !blocked) {
            await updateLastLogin(user.uid, user.email || undefined, user.displayName || undefined);
            
            // Track admin login for analytics
            await trackUserLogin(user.uid, {
              isAdmin: true,
              adminLevel: level,
              email: user.email,
            });
          }
        } catch (err) {
          console.error('Error checking admin status:', err);
          setIsAdmin(false);
          setAdminLevel(null);
          setIsBlocked(false);
        }
      } else {
        setIsAdmin(false);
        setAdminLevel(null);
        setIsBlocked(false);
      }
      
      setAdminLoading(false);
    }

    checkAdminStatus();
  }, [user, loading]);

  return {
    user: user || null,
    isAdmin,
    adminLevel,
    isBlocked,
    loading: loading || adminLoading,
    error: error || null,
  };
}

/**
 * Check if user has required admin level
 */
export function hasAdminLevel(
  userLevel: 'super' | 'moderator' | 'support' | null,
  requiredLevel: 'super' | 'moderator' | 'support'
): boolean {
  if (!userLevel) return false;
  
  const levels = { support: 1, moderator: 2, super: 3 };
  return levels[userLevel] >= levels[requiredLevel];
}

