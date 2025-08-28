'use client';

import React, { useState, useEffect } from 'react';
import { AdminCharacterView } from '@/types';
import { getUserCharacters, logAdminAction } from '@/lib/admin';
import { useAdminAuth } from '@/lib/adminAuth';
import { useAdminUserContext } from '@/lib/adminUserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Flag, Search, Filter, Calendar, User, MessageSquare, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, deleteDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CharacterOversightProps {
  characters: AdminCharacterView[];
  onCharacterAction: (characterId: string, action: CharacterAction) => void;
  onRefresh?: () => void;
  users?: { uid: string; displayName: string; email: string }[];
}

interface CharacterAction {
  type: 'delete' | 'flag' | 'unflag';
  reason: string;
}

interface CharacterFilters {
  search: string;
  flagged: 'all' | 'flagged' | 'unflagged';
  sortBy: 'name' | 'lastUsed' | 'messageCount' | 'reportCount';
  sortOrder: 'asc' | 'desc';
  selectedUser: 'all' | string;
}

export function CharacterOversight({ characters: initialCharacters, onCharacterAction, onRefresh, users = [] }: CharacterOversightProps) {
  const { user } = useAdminAuth();
  const { selectedUser } = useAdminUserContext();
  const [characters, setCharacters] = useState<AdminCharacterView[]>(initialCharacters);
  const [filteredCharacters, setFilteredCharacters] = useState<AdminCharacterView[]>(initialCharacters);
  const [loading, setLoading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<AdminCharacterView | null>(null);
  const [actionType, setActionType] = useState<'delete' | 'flag' | 'unflag' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [filters, setFilters] = useState<CharacterFilters>({
    search: '',
    flagged: 'all',
    sortBy: 'lastUsed',
    sortOrder: 'desc',
    selectedUser: 'all',
  });

  // Update characters when prop changes
  useEffect(() => {
    setCharacters(initialCharacters);
  }, [initialCharacters]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...characters];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(char => 
        char.name.toLowerCase().includes(searchLower) ||
        char.description.toLowerCase().includes(searchLower) ||
        char.userName.toLowerCase().includes(searchLower) ||
        char.userEmail.toLowerCase().includes(searchLower)
      );
    }

    // Apply flagged filter
    if (filters.flagged !== 'all') {
      filtered = filtered.filter(char => 
        filters.flagged === 'flagged' ? char.isFlagged : !char.isFlagged
      );
    }

    // Apply user filter from context or local filter
    const userFilter = selectedUser?.uid || filters.selectedUser;
    if (userFilter !== 'all') {
      filtered = filtered.filter(char => char.userId === userFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'lastUsed':
          aValue = a.lastUsed.getTime();
          bValue = b.lastUsed.getTime();
          break;
        case 'messageCount':
          aValue = a.messageCount;
          bValue = b.messageCount;
          break;
        case 'reportCount':
          aValue = a.reportCount;
          bValue = b.reportCount;
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredCharacters(filtered);
  }, [characters, filters, selectedUser]);

  const handleCharacterAction = async (character: AdminCharacterView, type: 'delete' | 'flag' | 'unflag', reason: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const characterRef = doc(db, `users/${character.userId}/characters`, character.id!);

      switch (type) {
        case 'delete':
          // Delete character document
          await deleteDoc(characterRef);
          
          // Delete all associated chat sessions and messages
          const chatSessionsRef = collection(db, `users/${character.userId}/chatSessions`);
          const chatSessionsSnapshot = await getDocs(chatSessionsRef);
          
          for (const sessionDoc of chatSessionsSnapshot.docs) {
            const sessionData = sessionDoc.data();
            if (sessionData.characterId === character.id) {
              // Delete messages in this session
              const messagesRef = collection(db, `users/${character.userId}/chatSessions/${sessionDoc.id}/messages`);
              const messagesSnapshot = await getDocs(messagesRef);
              
              for (const messageDoc of messagesSnapshot.docs) {
                await deleteDoc(messageDoc.ref);
              }
              
              // Delete the session
              await deleteDoc(sessionDoc.ref);
            }
          }
          
          // Remove from local state
          setCharacters(prev => prev.filter(c => c.id !== character.id));
          break;

        case 'flag':
          await updateDoc(characterRef, {
            isFlagged: true,
            flagReason: reason,
            flaggedAt: new Date(),
            flaggedBy: user.uid,
          });
          
          // Update local state
          setCharacters(prev => prev.map(c => 
            c.id === character.id 
              ? { ...c, isFlagged: true, flagReason: reason }
              : c
          ));
          break;

        case 'unflag':
          await updateDoc(characterRef, {
            isFlagged: false,
            flagReason: null,
            flaggedAt: null,
            flaggedBy: null,
          });
          
          // Update local state
          setCharacters(prev => prev.map(c => 
            c.id === character.id 
              ? { ...c, isFlagged: false, flagReason: undefined }
              : c
          ));
          break;
      }

      // Log the admin action
      await logAdminAction(
        user.uid,
        user.email || '',
        `${type}_character`,
        'character',
        character.id!,
        reason,
        {
          characterName: character.name,
          userId: character.userId,
          userEmail: character.userEmail,
        }
      );

      // Call the parent callback
      onCharacterAction(character.id!, { type, reason });

      // Reset dialog state
      setSelectedCharacter(null);
      setActionType(null);
      setActionReason('');

      // Refresh if callback provided
      if (onRefresh) {
        onRefresh();
      }

    } catch (error) {
      console.error(`Error ${type}ing character:`, error);
      alert(`Failed to ${type} character. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Character Oversight</h2>
          <p className="text-muted-foreground">
            Manage and moderate user-created characters
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {filteredCharacters.length} of {characters.length} characters
          </Badge>
          {onRefresh && (
            <Button onClick={onRefresh} variant="outline" size="sm">
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search characters, users..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.flagged} onValueChange={(value: any) => setFilters(prev => ({ ...prev, flagged: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Characters</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="unflagged">Not Flagged</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortBy} onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="lastUsed">Last Used</SelectItem>
                <SelectItem value="messageCount">Message Count</SelectItem>
                <SelectItem value="reportCount">Report Count</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortOrder} onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortOrder: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>


          </div>
        </CardContent>
      </Card>

      {/* Characters List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCharacters.map((character) => (
          <Card key={character.id} className={cn(
            "relative",
            character.isFlagged && "border-destructive"
          )}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center">
                    {character.name}
                    {character.isFlagged && (
                      <AlertTriangle className="h-4 w-4 ml-2 text-destructive" />
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {character.profession}, Age {character.age}
                  </p>
                </div>
                <div className="flex space-x-1">
                  {!character.isFlagged ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCharacter(character);
                            setActionType('flag');
                          }}
                        >
                          <Flag className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Flag Character</AlertDialogTitle>
                          <AlertDialogDescription>
                            Flag "{character.name}" for review. This will mark the character as potentially inappropriate.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            placeholder="Reason for flagging..."
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => {
                            setSelectedCharacter(null);
                            setActionType(null);
                            setActionReason('');
                          }}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCharacterAction(character, 'flag', actionReason)}
                            disabled={!actionReason.trim() || loading}
                          >
                            Flag Character
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCharacter(character);
                            setActionType('unflag');
                          }}
                        >
                          <Flag className="h-4 w-4 fill-current" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unflag Character</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove the flag from "{character.name}". This will mark the character as appropriate.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            placeholder="Reason for unflagging..."
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => {
                            setSelectedCharacter(null);
                            setActionType(null);
                            setActionReason('');
                          }}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCharacterAction(character, 'unflag', actionReason)}
                            disabled={!actionReason.trim() || loading}
                          >
                            Unflag Character
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCharacter(character);
                          setActionType('delete');
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Character</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{character.name}" and all associated chat history. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Reason for deletion..."
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                          setSelectedCharacter(null);
                          setActionType(null);
                          setActionReason('');
                        }}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleCharacterAction(character, 'delete', actionReason)}
                          disabled={!actionReason.trim() || loading}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Character
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {character.description}
                </p>
                
                {character.isFlagged && character.flagReason && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded">
                    <p className="text-sm text-destructive font-medium">Flagged:</p>
                    <p className="text-sm text-destructive">{character.flagReason}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {character.userName || character.userEmail}
                  </div>
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    {character.messageCount} messages
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Last used: {formatDate(character.lastUsed)}
                  </div>
                  {character.reportCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {character.reportCount} reports
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCharacters.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              {characters.length === 0 
                ? "No characters found." 
                : "No characters match your current filters."
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}