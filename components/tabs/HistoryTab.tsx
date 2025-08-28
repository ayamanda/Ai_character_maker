'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  where,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { ChatSession, CharacterData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  MessageCircle, 
  Calendar,
  Filter,
  Clock,
  Bot
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HistoryTabProps {
  onSessionSelect: (sessionId: string, characterData: CharacterData) => void;
}

interface GroupedSessions {
  [key: string]: ChatSession[];
}

export default function HistoryTab({ onSessionSelect }: HistoryTabProps) {
  const [user] = useAuthState(auth);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCharacterFilter, setSelectedCharacterFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Load all chat sessions
  useEffect(() => {
    if (!user) return;

    const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
    const q = query(sessionsRef, orderBy('lastMessageTime', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatSession));
      setSessions(fetchedSessions);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Load all characters for filtering
  useEffect(() => {
    if (!user) return;

    const charactersRef = collection(db, `users/${user.uid}/characters`);
    const q = query(charactersRef, orderBy('name'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCharacters = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CharacterData));
      setCharacters(fetchedCharacters);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter sessions based on search and character filter
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.characterData?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCharacter = 
      selectedCharacterFilter === 'all' || 
      session.characterId === selectedCharacterFilter;

    return matchesSearch && matchesCharacter;
  });

  // Group sessions by date
  const groupSessionsByDate = (sessions: ChatSession[]): GroupedSessions => {
    const groups: GroupedSessions = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    sessions.forEach(session => {
      const sessionDate = session.lastMessageTime?.toDate ? 
        session.lastMessageTime.toDate() : 
        new Date(session.lastMessageTime);

      let groupKey: string;

      if (sessionDate >= today) {
        groupKey = 'Today';
      } else if (sessionDate >= yesterday) {
        groupKey = 'Yesterday';
      } else if (sessionDate >= thisWeek) {
        groupKey = 'This Week';
      } else if (sessionDate >= thisMonth) {
        groupKey = 'This Month';
      } else {
        groupKey = 'Older';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(session);
    });

    return groups;
  };

  const groupedSessions = groupSessionsByDate(filteredSessions);
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-4 w-16 h-16 mx-auto mb-4 animate-pulse">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Chat History</h1>
          <Badge variant="secondary" className="gap-1">
            <MessageCircle className="h-3 w-3" />
            {sessions.length} conversations
          </Badge>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCharacterFilter} onValueChange={setSelectedCharacterFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="All characters" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Characters</SelectItem>
              {characters.map((character) => (
                <SelectItem key={character.id} value={character.id || ''}>
                  {character.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* History Timeline */}
      <ScrollArea className="flex-1 p-4">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-6 mb-6 shadow-lg">
              <MessageCircle className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Conversations Found</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {searchQuery || selectedCharacterFilter !== 'all' 
                ? "Try adjusting your search or filters to find conversations."
                : "Start chatting with your characters to see your conversation history here."
              }
            </p>
            {(searchQuery || selectedCharacterFilter !== 'all') && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCharacterFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupOrder.map(groupKey => {
              const groupSessions = groupedSessions[groupKey];
              if (!groupSessions || groupSessions.length === 0) return null;

              return (
                <div key={groupKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      {groupKey}
                    </h3>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  
                  <div className="space-y-2">
                    {groupSessions.map((session) => (
                      <Card 
                        key={session.id}
                        className="hover:shadow-md transition-all duration-200 cursor-pointer group"
                        onClick={() => onSessionSelect(session.id, session.characterData)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Character Avatar */}
                            <Avatar className="h-10 w-10 border-2 border-border flex-shrink-0">
                              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-semibold">
                                {session.characterData?.name?.slice(0, 2).toUpperCase() || 'AI'}
                              </AvatarFallback>
                            </Avatar>

                            {/* Session Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold truncate">
                                  {session.name}
                                </h4>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(session.lastMessageTime)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  <Bot className="h-3 w-3 mr-1" />
                                  {session.characterData?.name || 'Unknown Character'}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {session.messageCount} messages
                                </Badge>
                              </div>

                              {session.lastMessage && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {session.lastMessage}
                                </p>
                              )}

                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDate(session.lastMessageTime)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}