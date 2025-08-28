'use client';

import React, { useState, useMemo } from 'react';
import { AdminUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  ShieldCheck, 
  ShieldX,
  User,
  Calendar,
  MessageSquare,
  Users,
  UserCog,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserListProps {
  users: AdminUser[];
  onUserSelect: (userId: string) => void;
  onUserAction: (userId: string, action: UserAction) => void;
  onSyncUsers?: () => void;
  onSwitchToUser?: (user: AdminUser, section?: 'chats' | 'characters') => void;
  loading?: boolean;
}

export interface UserAction {
  type: 'block' | 'unblock' | 'delete' | 'makeAdmin' | 'removeAdmin';
  reason?: string;
  duration?: number;
}

interface UserFilters {
  search: string;
  status: 'all' | 'active' | 'blocked' | 'admin';
  adminLevel: 'all' | 'super' | 'moderator' | 'support';
}

export function UserList({ users, onUserSelect, onUserAction, onSyncUsers, onSwitchToUser, loading = false }: UserListProps) {
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    status: 'all',
    adminLevel: 'all',
  });

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch = 
          user.displayName.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        switch (filters.status) {
          case 'active':
            if (user.isBlocked) return false;
            break;
          case 'blocked':
            if (!user.isBlocked) return false;
            break;
          case 'admin':
            if (!user.isAdmin) return false;
            break;
        }
      }

      // Admin level filter
      if (filters.adminLevel !== 'all' && user.isAdmin) {
        if (user.adminLevel !== filters.adminLevel) return false;
      }

      return true;
    });
  }, [users, filters]);

  const getStatusBadge = (user: AdminUser) => {
    if (user.isBlocked) {
      return <Badge variant="destructive" className="text-xs">Blocked</Badge>;
    }
    if (user.isAdmin) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Shield className="w-3 h-3 mr-1" />
          {user.adminLevel}
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">Active</Badge>;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const handleUserAction = (userId: string, actionType: UserAction['type']) => {
    const user = users.find(u => u.uid === userId);
    if (!user) return;

    let reason = '';
    switch (actionType) {
      case 'block':
        reason = prompt('Reason for blocking user:') || '';
        if (!reason) return;
        break;
      case 'delete':
        if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
          return;
        }
        reason = 'Account deletion requested by admin';
        break;
      case 'makeAdmin':
        reason = 'Promoted to admin by administrator';
        break;
      case 'removeAdmin':
        reason = 'Admin privileges revoked by administrator';
        break;
    }

    onUserAction(userId, { type: actionType, reason });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Users...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-3 bg-muted rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search users by name or email..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={filters.status}
              onValueChange={(value: UserFilters['status']) => 
                setFilters(prev => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Users</SelectItem>
                <SelectItem value="blocked">Blocked Users</SelectItem>
                <SelectItem value="admin">Admin Users</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.adminLevel}
              onValueChange={(value: UserFilters['adminLevel']) => 
                setFilters(prev => ({ ...prev, adminLevel: value }))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Admin Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="super">Super Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Total users in system: {users.length} | Filtered results: {filteredUsers.length}</div>
            <div className="flex gap-4">
              <span>Active: {users.filter(u => !u.isBlocked && !u.isAdmin).length}</span>
              <span>Admins: {users.filter(u => u.isAdmin).length}</span>
              <span>Blocked: {users.filter(u => u.isBlocked).length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Users ({filteredUsers.length})
            </CardTitle>
            {users.length > 0 && (
              <div className="flex gap-2">
                {onSyncUsers && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onSyncUsers}
                  >
                    Sync Users
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {users.length === 0 ? 'No users found. Firebase Admin SDK must be configured to fetch users from Firebase Authentication.' : 'No users found matching your criteria.'}
              </p>
              {users.length === 0 && onSyncUsers && (
                <div className="space-y-2">
                  <Button onClick={onSyncUsers} variant="default">
                    Sync Users from Firebase Auth
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Requires Firebase Admin SDK configuration with service account key
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => onUserSelect(user.uid)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {user.displayName.charAt(0) || user.email.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">
                          {user.displayName || 'Unnamed User'}
                        </h3>
                        {getStatusBadge(user)}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Joined {formatDate(user.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {user.metadata.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {user.metadata.characterCount} characters
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onUserSelect(user.uid);
                        }}>
                          <User className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {onSwitchToUser && (
                          <>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onSwitchToUser(user, 'chats');
                            }}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              View User's Chats
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onSwitchToUser(user, 'characters');
                            }}>
                              <UserCog className="w-4 h-4 mr-2" />
                              View User's Characters
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        {!user.isAdmin && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleUserAction(user.uid, 'makeAdmin');
                          }}>
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                        )}
                        {user.isAdmin && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleUserAction(user.uid, 'removeAdmin');
                          }}>
                            <ShieldX className="w-4 h-4 mr-2" />
                            Remove Admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleUserAction(user.uid, user.isBlocked ? 'unblock' : 'block');
                        }}>
                          {user.isBlocked ? (
                            <>
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              Unblock User
                            </>
                          ) : (
                            <>
                              <ShieldX className="w-4 h-4 mr-2" />
                              Block User
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUserAction(user.uid, 'delete');
                          }}
                        >
                          <ShieldX className="w-4 h-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}