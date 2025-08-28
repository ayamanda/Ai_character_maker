'use client';

import { useState, useEffect, useRef } from 'react';
import { useMediaQuery } from 'react-responsive';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ArrowLeft,
  Trash2,
  Sparkles,
  Bot,
  User,
  History as HistoryIcon,
  MessageCircle,
} from 'lucide-react';
import ChatInput from '@/components/chat/ChatInput';
import MessageContent from '@/components/chat/MessageContent';
import { cn } from '@/lib/utils';

interface ChatTabProps {
  selectedCharacter: CharacterData | null;
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
  onBackToCharacters: () => void;
}

export default function ChatTab({
  selectedCharacter,
  currentSessionId,
  setCurrentSessionId,
  onBackToCharacters,
}: ChatTabProps) {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDesktop = useMediaQuery({ minWidth: 1024 });

  // Load chat history for selected character
  useEffect(() => {
    if (!user || !selectedCharacter?.id) {
      setChatHistory([]);
      return;
    }

    const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
    const q = query(sessionsRef, orderBy('lastMessageTime', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ChatSession))
        .filter(session => session.characterId === selectedCharacter.id);
      setChatHistory(sessions);
    });

    return () => unsubscribe();
  }, [user, selectedCharacter?.id]);

  // Show history panel when switching to chat tab (desktop only)
  useEffect(() => {
    if (selectedCharacter && chatHistory.length > 0 && isDesktop) {
      setShowHistoryPanel(true);
      
      // Auto-hide after 3 seconds unless user interacts
      historyTimeoutRef.current = setTimeout(() => {
        setShowHistoryPanel(false);
      }, 3000);
    }

    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [selectedCharacter, chatHistory.length, isDesktop]);

  // Listen to messages for current session
  useEffect(() => {
    if (!user || !currentSessionId) {
      setMessages([]);
      return;
    }

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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewSession = async (character: CharacterData) => {
    if (!user || !character.id) return null;

    const sessionData = {
      name: `Chat with ${character.name}`,
      characterId: character.id,
      characterData: character,
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      createdAt: serverTimestamp(),
      messageCount: 0,
    };

    try {
      const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
      const docRef = await addDoc(sessionsRef, sessionData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating new session:', error);
      return null;
    }
  };

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

  const getAIResponse = async (userMessage: string, sessionId?: string) => {
    const targetSessionId = sessionId || currentSessionId;
    if (!selectedCharacter || !user || !targetSessionId) return;

    setIsLoading(true);
    let streamingMessageRef: any = null;
    let accumulatedText = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          characterData: selectedCharacter,
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
        displayName: selectedCharacter.name,
        character: true,
      };

      const messagesRef = collection(db, `users/${user.uid}/chatSessions/${targetSessionId}/messages`);
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
                console.warn('Failed to parse JSON:', data);
              }
            }
          }
        }
      }

      if (accumulatedText.trim() === '' && streamingMessageRef) {
        const fallbackText = "I'm here and ready to chat! How can I help you?";
        await updateDoc(streamingMessageRef, {
          text: fallbackText,
        });
        accumulatedText = fallbackText;
      }

      await updateSessionLastMessage(targetSessionId, accumulatedText.slice(0, 100));
    } catch (error: any) {
      console.error('Error fetching AI response:', error);
      if (streamingMessageRef && accumulatedText === '') {
        await deleteDoc(streamingMessageRef);

        const errorMessage: Omit<Message, 'id'> = {
          text: "I'm sorry, I'm having trouble responding right now. Please try again.",
          createdAt: serverTimestamp(),
          uid: 'ai',
          photoURL: null,
          displayName: selectedCharacter.name,
          character: true,
        };

        try {
          const messagesRef = collection(db, `users/${user.uid}/chatSessions/${targetSessionId}/messages`);
          await addDoc(messagesRef, errorMessage);
        } catch (e) {
          console.error('Error adding error message:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageText: string) => {
    if (!user || !selectedCharacter) return;

    // Hide history panel when user starts typing
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    setShowHistoryPanel(false);

    let sessionId = currentSessionId;
    let isNewSession = false;

    // Create new session if none exists
    if (!sessionId) {
      sessionId = await createNewSession(selectedCharacter);
      if (!sessionId) return;
      isNewSession = true;
      setCurrentSessionId(sessionId);
    }

    const newMessage: Omit<Message, 'id'> = {
      text: messageText,
      createdAt: serverTimestamp(),
      uid: user.uid,
      photoURL: user.photoURL,
      displayName: user.displayName,
      character: false,
    };

    try {
      const messagesRef = collection(db, `users/${user.uid}/chatSessions/${sessionId}/messages`);
      await addDoc(messagesRef, newMessage);
      await updateSessionLastMessage(sessionId, messageText.slice(0, 100));
      
      await getAIResponse(messageText, sessionId);
    } catch (error: any) {
      console.error('Error adding message:', error);
    }
  };

  const handleSessionSelect = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setShowHistoryPanel(false);
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
        "flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 group animate-in slide-in-from-bottom-2 duration-300",
        msg.uid === user?.uid ? "flex-row-reverse" : ""
      )}
    >
      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border-2 border-border flex-shrink-0">
        <AvatarFallback className={cn(
          "text-xs font-medium",
          msg.character ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white" : "bg-primary text-primary-foreground"
        )}>
          {msg.character ? <Bot className="h-3 w-3 sm:h-4 sm:w-4" /> : <User className="h-3 w-3 sm:h-4 sm:w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn(
        "flex flex-col max-w-[85%] sm:max-w-[80%] min-w-0",
        msg.uid === user?.uid ? "items-end" : "items-start"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {msg.character ? selectedCharacter?.name : msg.displayName}
          </span>
          {msg.character && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
        </div>

        <div className={cn(
          "p-3 sm:p-4 rounded-2xl shadow-sm border transition-all duration-200",
          msg.uid === user?.uid
            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-md"
            : "bg-card text-card-foreground rounded-bl-md hover:shadow-md"
        )}>
          <MessageContent
            content={msg.text}
            isUser={msg.uid === user?.uid}
          />
        </div>
      </div>
    </div>
  );

  if (!selectedCharacter) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-6 mb-6 shadow-lg">
          <MessageCircle className="h-12 w-12 text-white" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Character Selected</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          Select a character from the Characters tab to start chatting.
        </p>
        <Button onClick={onBackToCharacters} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go to Characters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBackToCharacters}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <Avatar className="h-10 w-10 border-2 border-border">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {selectedCharacter.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h2 className="font-semibold text-lg">{selectedCharacter.name}</h2>
                <Badge variant="secondary" className="text-xs">
                  {selectedCharacter.profession}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* History Panel Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (historyTimeoutRef.current) {
                    clearTimeout(historyTimeoutRef.current);
                  }
                  setShowHistoryPanel(!showHistoryPanel);
                }}
                className={cn(
                  "transition-colors",
                  showHistoryPanel && "bg-accent"
                )}
              >
                <HistoryIcon className="h-4 w-4" />
              </Button>

              {currentSessionId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearCurrentChat}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea 
          className="flex-1 p-6"
          onClick={() => {
            if (isDesktop && showHistoryPanel) {
              setShowHistoryPanel(false);
            }
          }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Avatar className="h-20 w-20 mb-4 border-4 border-border shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl">
                  {selectedCharacter.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-semibold mb-2">
                Chat with {selectedCharacter.name}
              </h3>
              <p className="text-muted-foreground mb-4">
                Start a conversation with your AI character
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <Badge variant="outline">{selectedCharacter.profession}</Badge>
                <Badge variant="outline">{selectedCharacter.tone}</Badge>
                <Badge variant="outline">Age {selectedCharacter.age}</Badge>
              </div>
              {selectedCharacter.description && (
                <div className="bg-card/50 rounded-lg p-4 max-w-md border">
                  <p className="text-sm text-muted-foreground">
                    {selectedCharacter.description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(renderMessage)}

              {isLoading && (
                <div className="flex items-start gap-3 mb-6 animate-in slide-in-from-bottom-2 duration-300">
                  <Avatar className="h-8 w-8 border-2 border-border">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card border rounded-2xl rounded-bl-md p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Desktop Chat History Sidebar */}
      {showHistoryPanel && isDesktop && (
        <div 
          className="w-80 border-l border-border bg-card/30 backdrop-blur-sm"
          onMouseEnter={() => {
            if (historyTimeoutRef.current) {
              clearTimeout(historyTimeoutRef.current);
            }
          }}
          onMouseLeave={() => {
            historyTimeoutRef.current = setTimeout(() => {
              setShowHistoryPanel(false);
            }, 1000);
          }}
        >
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Chat History</h3>
            <p className="text-sm text-muted-foreground">
              Previous conversations with {selectedCharacter.name}
            </p>
          </div>
          
          <ScrollArea className="flex-1">
            {chatHistory.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No previous conversations
                </p>
              </div>
            ) : (
              <div className="p-2">
                {chatHistory.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSessionSelect(session)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 mb-2",
                      currentSessionId === session.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {session.name}
                        </p>
                        {session.lastMessage && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {session.lastMessage}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.messageCount} messages
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Mobile Chat History Sheet */}
      <Sheet open={showHistoryPanel && !isDesktop} onOpenChange={setShowHistoryPanel}>
        <SheetContent side="bottom" className="h-[70vh] p-0">
          <SheetHeader className="p-4 border-b bg-card/50 backdrop-blur-sm">
            <SheetTitle className="text-left">Chat History</SheetTitle>
            <p className="text-sm text-muted-foreground text-left">
              Previous conversations with {selectedCharacter.name}
            </p>
          </SheetHeader>
          
          <ScrollArea className="flex-1 p-4">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No previous conversations
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatHistory.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSessionSelect(session)}
                    className={cn(
                      "p-4 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 border",
                      currentSessionId === session.id && "bg-accent border-primary"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <MessageCircle className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {session.name}
                        </p>
                        {session.lastMessage && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {session.lastMessage}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">
                            {session.messageCount} messages
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.lastMessageTime?.toDate?.()?.toLocaleDateString() || ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}