'use client';

import React, { useState } from 'react';
import { AdminUser, AdminCharacterView, AdminChatView } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Shield, 
  ShieldCheck, 
  ShieldX,
  User,
  Calendar,
  MessageSquare,
  Users,
  Mail,
  Clock,
  AlertTriangle,
  Trash2,
  UserCog
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserAction } from './UserList';

interface UserDetailsProps {
  user: AdminUser;
  characters: AdminCharacterView[];
  chatSessions: AdminChatView[];
  onUpdateUser: (updates: Partial<AdminUser>) => void;
  onUserAction: (userId: string, action: UserAction) => void;
  onBack: () => void;
  loading?: boolean;
}

export function UserDetails({ 
  user, 
  characters, 
  chatSessions, 
  onUpdateUser, 
  onUserAction,
  onBack,
  loading = false 
}: UserDetailsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const handleUserAction = async (actionType: UserAction['type']) => {
    setActionLoading(actionType);
    
    try {
      let reason = '';
      switch (actionType) {
        case 'block':
          reason = prompt('Reason for blocking user:') || '';
          if (!reason) return;
          break;
        case 'delete':
          reason = 'Account deletion requested by admin';
          break;
        case 'makeAdmin':
          reason = 'Promoted to admin by administrator';
          break;
        case 'removeAdmin':
          reason = 'Admin privileges revoked by administrator';
          break;
        case 'unblock':
          reason = 'User unblocked by administrator';
          break;
      }

      await onUserAction(user.uid, { type: actionType, reason });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (user.isBlocked) {
      return (
        <Badge variant="destructive" className="text-sm">
          <ShieldX className="w-4 h-4 mr-1" />
          Blocked
        </Badge>
      );
    }
    if (user.isAdmin) {
      return (
        <Badge variant="secondary" className="text-sm">
          <Shield className="w-4 h-4 mr-1" />
          {user.adminLevel} Admin
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-sm">
        <ShieldCheck className="w-4 h-4 mr-1" />
        Active
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Details</h1>
            <p className="text-muted-foreground">Manage user account and permissions</p>
          </div>
        </div>
      </div>

      {/* User Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-medium text-primary">
                  {user.displayName.charAt(0) || user.email.charAt(0)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    {user.displayName || 'Unnamed User'}
                  </h2>
                  {getStatusBadge()}
                </div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {formatDateShort(user.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Last login {formatDateShort(user.lastLogin)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!user.isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => handleUserAction('makeAdmin')}
                  disabled={actionLoading === 'makeAdmin'}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Make Admin
                </Button>
              )}
              {user.isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => handleUserAction('removeAdmin')}
                  disabled={actionLoading === 'removeAdmin'}
                >
                  <ShieldX className="w-4 h-4 mr-2" />
                  Remove Admin
                </Button>
              )}
              <Button
                variant={user.isBlocked ? "default" : "destructive"}
                onClick={() => handleUserAction(user.isBlocked ? 'unblock' : 'block')}
                disabled={actionLoading === 'block' || actionLoading === 'unblock'}
              >
                {user.isBlocked ? (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Unblock
                  </>
                ) : (
                  <>
                    <ShieldX className="w-4 h-4 mr-2" />
                    Block
                  </>
                )}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to permanently delete this user account? 
                      This will remove all their characters, chat history, and personal data. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleUserAction('delete')}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-accent/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Messages</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                {user.metadata.messageCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-accent/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Characters</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                {user.metadata.characterCount}
              </p>
            </div>
            <div className="bg-accent/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Chat Sessions</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                {chatSessions.length}
              </p>
            </div>
            <div className="bg-accent/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="text-sm font-medium text-muted-foreground">Flagged Content</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                {user.metadata.flaggedContent}
              </p>
            </div>
          </div>
          
          {user.isBlocked && user.blockReason && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="font-medium text-destructive">Account Blocked</span>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Reason:</strong> {user.blockReason}
              </p>
              {user.blockExpiry && (
                <p className="text-sm text-muted-foreground">
                  <strong>Expires:</strong> {formatDate(user.blockExpiry)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Information */}
      <Tabs defaultValue="characters" className="space-y-4">
        <TabsList>
          <TabsTrigger value="characters">Characters ({characters.length})</TabsTrigger>
          <TabsTrigger value="chats">Chat Sessions ({chatSessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="characters">
          <Card>
            <CardHeader>
              <CardTitle>User Characters</CardTitle>
            </CardHeader>
            <CardContent>
              {characters.length === 0 ? (
                <div className="text-center py-8">
                  <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No characters created yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {characters.map((character) => (
                    <div
                      key={character.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{character.name}</h3>
                          {character.isFlagged && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Flagged
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {character.profession}, Age {character.age}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {character.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Created {formatDateShort(character.createdAt?.toDate() || new Date())}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {character.messageCount} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last used {formatDateShort(character.lastUsed)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chats">
          <Card>
            <CardHeader>
              <CardTitle>Chat Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {chatSessions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No chat sessions found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatSessions.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{chat.name}</h3>
                          {chat.isFlagged && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Flagged
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Character: {chat.characterData.name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          Last message: {chat.lastMessage}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Started {formatDateShort(chat.createdAt?.toDate() || new Date())}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {chat.totalMessages} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last activity {formatDateShort(chat.lastActivity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}