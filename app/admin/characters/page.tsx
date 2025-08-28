'use client';

import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CharacterOversight } from '@/components/admin/CharacterOversight';
import { useAdminCharacters, useAdminUsers } from '@/lib/useAdminData';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

export default function AdminCharacters() {
  const { characters, loading, error, refreshCharacters } = useAdminCharacters();
  const { users } = useAdminUsers();

  const handleCharacterAction = (characterId: string, action: { type: string; reason: string }) => {
    console.log(`Character ${characterId} action:`, action);
    // The CharacterOversight component handles the actual action
    // This callback is for any additional handling if needed
  };

  const handleRefresh = () => {
    toast.info('Refreshing character data...');
    refreshCharacters().then(() => {
      toast.success(`Loaded ${characters.length} characters`);
    }).catch(() => {
      toast.error('Failed to refresh characters');
    });
  };

  if (loading && characters.length === 0) {
    return (
      <AdminLayout currentPage="Characters">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  if (error && characters.length === 0) {
    return (
      <AdminLayout currentPage="Characters">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => refreshCharacters()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="Characters">
      <CharacterOversight
        characters={characters}
        onCharacterAction={handleCharacterAction}
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