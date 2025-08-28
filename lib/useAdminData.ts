// lib/useAdminData.ts
import { useState, useEffect, useCallback } from 'react';
import { AdminUser, AdminCharacterView, AdminChatView } from '@/types';
import { 
  getAllUsers, 
  getUserById, 
  getUsersByIds,
  getAllCharacters, 
  getAllChatSessions,
  clearAdminCaches,
  getCacheStatus
} from './admin';

/**
 * Hook for managing admin user data with optimized caching
 */
export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const userData = await getAllUsers(forceRefresh);
      setUsers(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUsers = useCallback(() => {
    return loadUsers(true);
  }, [loadUsers]);

  const getUserByIdCached = useCallback(async (userId: string): Promise<AdminUser | null> => {
    // First check if user is in current cache
    const cachedUser = users.find(u => u.uid === userId);
    if (cachedUser) {
      return cachedUser;
    }
    
    // Otherwise fetch from Firestore
    return getUserById(userId);
  }, [users]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return {
    users,
    loading,
    error,
    refreshUsers,
    getUserById: getUserByIdCached,
    getUsersByIds,
  };
}

/**
 * Hook for managing admin character data
 */
export function useAdminCharacters() {
  const [characters, setCharacters] = useState<AdminCharacterView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCharacters = useCallback(async (forceRefresh = false, limit = 100) => {
    try {
      setLoading(true);
      setError(null);
      const characterData = await getAllCharacters(forceRefresh, limit);
      setCharacters(characterData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load characters');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCharacters = useCallback((limit = 100) => {
    return loadCharacters(true, limit);
  }, [loadCharacters]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  return {
    characters,
    loading,
    error,
    refreshCharacters,
  };
}

/**
 * Hook for managing admin chat data
 */
export function useAdminChats() {
  const [chats, setChats] = useState<AdminChatView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async (forceRefresh = false, limit = 100) => {
    try {
      setLoading(true);
      setError(null);
      const chatData = await getAllChatSessions(forceRefresh, limit);
      setChats(chatData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshChats = useCallback((limit = 100) => {
    return loadChats(true, limit);
  }, [loadChats]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  return {
    chats,
    loading,
    error,
    refreshChats,
  };
}

/**
 * Hook for cache management and debugging
 */
export function useAdminCache() {
  const [cacheStatus, setCacheStatus] = useState<any>(null);

  const updateCacheStatus = useCallback(() => {
    setCacheStatus(getCacheStatus());
  }, []);

  const clearCaches = useCallback(() => {
    clearAdminCaches();
    updateCacheStatus();
  }, [updateCacheStatus]);

  useEffect(() => {
    updateCacheStatus();
    const interval = setInterval(updateCacheStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [updateCacheStatus]);

  return {
    cacheStatus,
    clearCaches,
    updateCacheStatus,
  };
}