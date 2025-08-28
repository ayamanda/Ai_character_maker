'use client';
import { useState, useEffect, useRef } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '@/lib/firebase';
import { CharacterData, Message, ChatSession } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Settings,
  Trash2,
  RefreshCcw,
  Sparkles,
  Bot,
  User,
  Menu,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import ChatInput from './ChatInput';
import ChatHistory from './ChatHistory';
import CharacterForm from '@/components/CharacterForm';
import SignOutButton from '@/components/SignOutButton';
import { cn } from '@/lib/utils';

export default function ModernChat() {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedCharacterData = localStorage.getItem('characterData');
    if (storedCharacterData) {
      setCharacterData(JSON.parse(storedCharacterData));
    }
  }, []);

  useEffect(() => {
    if (!user || !currentSessionId) return;

    const messagesRef = collection(db, `users/${user.uid}/chatSessions/${currentSessionId}/messages`);
    const q = query(messagesRef, orderBy('createdAt'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Message)
      );
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [user, currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateSessionLastMessage = async (sessionId: string, lastMessage: string) => {
    if (!user) return;
    
    try {
      const sessionRef = doc(db, `users/${user.uid}/chatSessions`, sessionId);
      await updateDoc(sessionRef, {
        lastMessage,
        lastMessageTime: serverTimestamp(),
        messageCount: messages.length + 1,
      });
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  const getAIResponse = async (userMessage: string) => {
    if (!characterData || !user || !currentSessionId) return;

    setIsLoading(true);
    let streamingMessageRef: any = null;
    let accumulatedText = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          characterData,
          messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const initialMessage: Omit<Message, 'id'> = {
        text: '',
        createdAt: serverTimestamp(),
        uid: 'ai',
        photoURL: null,
        displayName: characterData.name,
        character: true,
      };

      const messagesRef = collection(db, `users/${user.uid}/chatSessions/${currentSessionId}/messages`);
      streamingMessageRef = await addDoc(messagesRef, initialMessage);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedText += parsed.content;
                  await updateDoc(streamingMessageRef, {
                    text: accumulatedText,
                  });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Update session with last message
      await updateSessionLastMessage(currentSessionId, accumulatedText.slice(0, 100));
    } catch (error: any) {
      console.error('Error fetching AI response:', error);
      if (streamingMessageRef && accumulatedText === '') {
        await deleteDoc(streamingMessageRef);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageText: string) => {
    if (!user || !currentSessionId || !characterData) return;

    const newMessage: Omit<Message, 'id'> = {
      text: messageText,
      createdAt: serverTimestamp(),
      uid: user.uid,
      photoURL: user.photoURL,
      displayName: user.displayName,
      character: false,
    };

    try {
      const messagesRef = collection(db, `users/${user.uid}/chatSessions/${currentSessionId}/messages`);
      await addDoc(messagesRef, newMessage);
      await updateSessionLastMessage(currentSessionId, messageText.slice(0, 100));
      await getAIResponse(messageText);
    } catch (error: any) {
      console.error('Error adding message:', error);
    }
  };

  const handleSessionSelect = (sessionId: string, sessionCharacterData: CharacterData) => {
    setCurrentSessionId(sessionId);
    setCharacterData(sessionCharacterData);
    localStorage.setItem('characterData', JSON.stringify(sessionCharacterData));
    setIsMobileMenuOpen(false);
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setShowCharacterForm(true);
    setIsMobileMenuOpen(false);
  };

  const handleCharacterUpdate = (data: CharacterData) => {
    setCharacterData(data);
    localStorage.setItem('characterData', JSON.stringify(data));
    setShowCharacterForm(false);
  };

  const clearCurrentChat = async () => {
    if (!user || !currentSessionId) return;

    setIsLoading(true);
    try {
      const messagesRef = collection(db, `users/${user.uid}/chatSessions/${currentSessionId}/messages`);
      const querySnapshot = await getDocs(query(messagesRef));
      
      const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      setMessages([]);
    } catch (error: any) {
      console.error('Error clearing messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (msg: Message) => (
    <div
      key={msg.id}
      className={cn(
        "flex items-start gap-3 mb-6 group",
        msg.uid === user?.uid ? "flex-row-reverse" : ""
      )}
    >
      <Avatar className="h-8 w-8 border-2 border-border">
        <AvatarImage src={msg.photoURL || ''} alt={msg.displayName || ''} />
        <AvatarFallback className={cn(
          "text-xs font-medium",
          msg.character ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white" : "bg-primary text-primary-foreground"
        )}>
          {msg.character ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "flex flex-col max-w-[80%]",
        msg.uid === user?.uid ? "items-end" : "items-start"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {msg.character ? characterData?.name : msg.displayName}
          </span>
          {msg.character && (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
        </div>
        
        <div className={cn(
          "p-4 rounded-2xl shadow-sm border transition-all duration-200",
          msg.uid === user?.uid
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card text-card-foreground rounded-bl-md hover:shadow-md"
        )}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        </div>
      </div>
    </div>
  );

  if (!user) {
    return <div>Please sign in to continue</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <ChatHistory
          currentSessionId={currentSessionId}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          characterData={characterData}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle>Chat History</SheetTitle>
                  </SheetHeader>
                  <ChatHistory
                    currentSessionId={currentSessionId}
                    onSessionSelect={handleSessionSelect}
                    onNewChat={handleNewChat}
                    characterData={characterData}
                  />
                </SheetContent>
              </Sheet>

              {characterData && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-border">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold text-lg">{characterData.name}</h2>
                    <Badge variant="secondary" className="text-xs">
                      {characterData.profession}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentSessionId && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearCurrentChat}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCharacterForm(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </>
              )}
              <SignOutButton />
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-6">
          {!currentSessionId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-6 mb-6">
                <Bot className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Welcome to AI Character Chat</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Create a new character or select from your chat history to start a conversation.
              </p>
              <Button onClick={handleNewChat} size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Start New Chat
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Avatar className="h-20 w-20 mb-4 border-4 border-border">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl">
                  <Bot className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-semibold mb-2">
                Chat with {characterData?.name}
              </h3>
              <p className="text-muted-foreground mb-4">
                Start a conversation with your AI character
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(renderMessage)}
              
              {isLoading && (
                <div className="flex items-start gap-3 mb-6">
                  <Avatar className="h-8 w-8 border-2 border-border">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card border rounded-2xl rounded-bl-md p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Chat Input */}
        {currentSessionId && (
          <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Character Form Dialog */}
      <Dialog open={showCharacterForm} onOpenChange={setShowCharacterForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {characterData ? 'Edit Character' : 'Create Character'}
            </DialogTitle>
          </DialogHeader>
          <CharacterForm onCharacterSubmit={handleCharacterUpdate} />
        </DialogContent>
      </Dialog>
    </div>
  );
}