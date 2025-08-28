'use client';

import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ChatMonitor } from '@/components/admin/ChatMonitor';
import { useAdminChats, useAdminUsers } from '@/lib/useAdminData';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

export default function AdminChats() {
  const { chats, loading, error, refreshChats } = useAdminChats();
  const { users } = useAdminUsers();

  const handleChatSelect = (chatId: string) => {
    console.log(`Selected chat: ${chatId}`);
    // This callback is for any additional handling when a chat is selected
  };

  const handleRefresh = () => {
    toast.info('Refreshing chat data...');
    refreshChats().then(() => {
      toast.success(`Loaded ${chats.length} chat sessions`);
    }).catch(() => {
      toast.error('Failed to refresh chats');
    });
  };

  if (loading && chats.length === 0) {
    return (
      <AdminLayout currentPage="Chats">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  if (error && chats.length === 0) {
    return (
      <AdminLayout currentPage="Chats">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => refreshChats()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="Chats">
      <ChatMonitor
        chats={chats}
        onChatSelect={handleChatSelect}
        onRefresh={handleRefresh}
        users={users.map(user => ({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email
        }))}
      />
    </AdminLayout>
  );
}