'use client';

import React, { useState, useEffect } from 'react';
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard';
import { UserList, UserAction } from '@/components/admin/UserList';
import { UserDetails } from '@/components/admin/UserDetails';
import { useAdminAuth } from '@/lib/adminAuth';
import { useAdminUsers } from '@/lib/useAdminData';
import { useAdminUserContext } from '@/lib/adminUserContext';
import { useRouter } from 'next/navigation';
import { 
  blockUser, 
  unblockUser, 
  deleteUser, 
  makeUserAdmin, 
  removeUserAdmin,
  getUserCharacters,
  getUserChatSessions,
  syncAllUsers
} from '@/lib/admin';
import { AdminUser, AdminCharacterView, AdminChatView } from '@/types';
import { toast } from 'sonner';

export default function AdminUsers() {
  const { user: currentUser } = useAdminAuth();
  const { users, loading, error, refreshUsers, getUserById } = useAdminUsers();
  const { setSelectedUser: setContextUser } = useAdminUserContext();
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userCharacters, setUserCharacters] = useState<AdminCharacterView[]>([]);
  const [userChatSessions, setUserChatSessions] = useState<AdminChatView[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Show error toast if there's an error
  useEffect(() => {
    if (error) {
      toast.error('Failed to load users: ' + error);
    }
  }, [error]);



  const handleSyncUsers = async () => {
    try {
      toast.info('Syncing users from Firebase Auth...');
      const userCount = await syncAllUsers();
      if (userCount > 0) {
        toast.success(`Synced ${userCount} users from Firebase data`);
      } else {
        toast.warning('No users found. Check Firebase Admin SDK configuration or create sample users.');
      }
      await refreshUsers(); // Use the hook's refresh function
    } catch (error) {
      console.error('Error syncing users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to sync users: ${errorMessage}`);
    }
  };

  const handleUserSelect = async (userId: string) => {
    console.log('Selecting user:', userId);
    
    // Use the optimized getUserById function
    const user = await getUserById(userId);
    if (!user) {
      console.error('User not found:', userId);
      toast.error('User not found');
      return;
    }

    try {
      setDetailsLoading(true);
      setSelectedUser(user);
      console.log('Selected user:', user);
      
      // Load user's characters and chat sessions
      console.log('Loading user data for:', userId);
      const [characters, chatSessions] = await Promise.all([
        getUserCharacters(userId),
        getUserChatSessions(userId)
      ]);
      
      console.log('Loaded characters:', characters.length);
      console.log('Loaded chat sessions:', chatSessions.length);
      
      setUserCharacters(characters);
      setUserChatSessions(chatSessions);
    } catch (error) {
      console.error('Error loading user details:', error);
      toast.error('Failed to load user details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleUserAction = async (userId: string, action: UserAction) => {
    if (!currentUser) return;

    try {
      switch (action.type) {
        case 'block':
          await blockUser(userId, action.reason || '', currentUser.uid, currentUser.email || '');
          toast.success('User blocked successfully');
          break;
        case 'unblock':
          await unblockUser(userId, action.reason || '', currentUser.uid, currentUser.email || '');
          toast.success('User unblocked successfully');
          break;
        case 'delete':
          await deleteUser(userId, action.reason || '', currentUser.uid, currentUser.email || '');
          toast.success('User deleted successfully');
          setSelectedUser(null);
          break;
        case 'makeAdmin':
          await makeUserAdmin(userId, 'support', action.reason || '', currentUser.uid, currentUser.email || '');
          toast.success('User promoted to admin');
          break;
        case 'removeAdmin':
          await removeUserAdmin(userId, action.reason || '', currentUser.uid, currentUser.email || '');
          toast.success('Admin privileges removed');
          break;
      }
      
      // Reload users to reflect changes
      await refreshUsers(); // Force refresh after user action
      
      // Update selected user if it's still selected
      if (selectedUser && selectedUser.uid === userId && action.type !== 'delete') {
        const updatedUser = users.find(u => u.uid === userId);
        if (updatedUser) {
          setSelectedUser(updatedUser);
        }
      }
    } catch (error) {
      console.error('Error performing user action:', error);
      toast.error(`Failed to ${action.type} user`);
    }
  };

  const handleUpdateUser = async (updates: Partial<AdminUser>) => {
    if (!selectedUser) return;
    
    // This would typically update the user in the database
    // For now, we'll just update the local state
    const updatedUser = { ...selectedUser, ...updates };
    setSelectedUser(updatedUser);
    
    // Note: In a real implementation, this would update the database
    // The users list will be refreshed from the hook automatically
  };

  const handleBack = () => {
    setSelectedUser(null);
    setUserCharacters([]);
    setUserChatSessions([]);
  };

  const handleSwitchToUser = (user: AdminUser, section: 'chats' | 'characters' = 'chats') => {
    // Set the user in the global context
    setContextUser(user);
    // Navigate to the specified section to show this user's data
    router.push(`/admin/${section}`);
  };

  return (
    <AdminRouteGuard requiredLevel="moderator">
      <div className="space-y-6">
        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted/50 p-4 rounded-lg text-sm">
            <strong>Debug Info:</strong> Users loaded: {users.length}, Selected: {selectedUser?.displayName || 'None'}
          </div>
        )}
        
        {selectedUser ? (
          <UserDetails
            user={selectedUser}
            characters={userCharacters}
            chatSessions={userChatSessions}
            onUpdateUser={handleUpdateUser}
            onUserAction={handleUserAction}
            onBack={handleBack}
            loading={detailsLoading}
          />
        ) : (
          <UserList
            users={users}
            onUserSelect={handleUserSelect}
            onUserAction={handleUserAction}
            onSyncUsers={handleSyncUsers}
            onSwitchToUser={handleSwitchToUser}
            loading={loading}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}