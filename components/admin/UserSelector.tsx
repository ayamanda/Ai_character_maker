'use client';

import React from 'react';
import { AdminUser } from '@/types';
import { useAdminUserContext } from '@/lib/adminUserContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, X } from 'lucide-react';

interface UserSelectorProps {
  users: AdminUser[];
  className?: string;
}

export function UserSelector({ users, className }: UserSelectorProps) {
  const { selectedUser, setSelectedUser, clearSelectedUser } = useAdminUserContext();

  const handleUserSelect = (userId: string) => {
    if (userId === 'all') {
      clearSelectedUser();
    } else {
      const user = users.find(u => u.uid === userId);
      if (user) {
        setSelectedUser(user);
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filter by user:</span>
      </div>
      
      <Select
        value={selectedUser?.uid || 'all'}
        onValueChange={handleUserSelect}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Select a user" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.uid} value={user.uid}>
              <div className="flex items-center gap-2">
                <span>{user.displayName || user.email}</span>
                {user.isAdmin && (
                  <Badge variant="secondary" className="text-xs">
                    {user.adminLevel}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedUser && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {selectedUser.displayName || selectedUser.email}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={clearSelectedUser}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        </div>
      )}
    </div>
  );
}