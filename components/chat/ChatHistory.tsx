'use client';
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '@/lib/firebase';
import { ChatSession, CharacterData } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  MessageSquare,
  Trash2,
  Clock,
  User,
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
import { cn } from '@/lib/utils';

interface ChatHistoryProps {
  currentSessionId: string | null;
  selectedCharacterId: string | null;
  onSessionSelect: (sessionId: string, characterData: CharacterData) => void;
  onNewChat: () => void;
}

export default function ChatHistory({
  currentSessionId,
  selectedCharacterId,
  onSessionSelect,
  onNewChat,
}: ChatHistoryProps) {
  const [user] = useAuthState(auth);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !selectedCharacterId) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
    const q = query(sessionsRef, orderBy('lastMessageTime', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as ChatSession)
      ).filter(session => session.characterId === selectedCharacterId);
      
      setSessions(fetchedSessions);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, selectedCharacterId]);

  const createNewSession = async () => {
    onNewChat();
  };

  const deleteSession = async (sessionId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/chatSessions`, sessionId));
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-card border-r border-border p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border">
        <Button
          onClick={createNewSession}
          className="w-full justify-start gap-2"
          variant="default"
          disabled={!selectedCharacterId}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No chat history yet</p>
              <p className="text-sm">Start a conversation to see it here</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-accent touch-manipulation",
                  currentSessionId === session.id && "bg-accent border border-border ring-1 ring-primary/20"
                )}
                onClick={() => onSessionSelect(session.id, session.characterData)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-sm truncate">
                        {session.characterData.name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs mb-2">
                      {session.characterData.profession}
                    </Badge>
                    {session.lastMessage && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {session.lastMessage}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(session.lastMessageTime)}</span>
                      {session.messageCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {session.messageCount} msgs
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity touch-manipulation"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Chat Session</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this chat session with {session.characterData.name}? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteSession(session.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}