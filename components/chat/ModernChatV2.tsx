'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
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
  limit,
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '@/lib/firebase';
import { CharacterData, Message, ChatSession, StreamState, SSEEvent, ToolCallRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Sparkles,
  Bot,
  User,
  Menu,
  RefreshCw,
  Headphones,
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
import CharacterSelector from './CharacterSelector';
import SignOutButton from '@/components/SignOutButton';
import MessageContent from './MessageContent';
import StreamStatusBar from './StreamStatusBar';
import LiveModePanel from './LiveModePanel';
import { cn } from '@/lib/utils';

export default function ModernChatV2() {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallRecord[]>([]);
  const [isLiveModeOpen, setIsLiveModeOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  const isStreaming = streamState !== 'idle' && streamState !== 'done' && streamState !== 'error' && streamState !== 'cancelled';

  // ─── Smart scroll: only auto-scroll when user is near bottom ───────────────

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isNearBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Load latest character + session on mount ─────────────────────────────

  useEffect(() => {
    if (!user || isInitialized) return;

    const loadLatestData = async () => {
      try {
        const charactersRef = collection(db, `users/${user.uid}/characters`);
        const charactersQuery = query(charactersRef, orderBy('lastUsed', 'desc'), limit(1));
        const charactersSnapshot = await getDocs(charactersQuery);

        if (!charactersSnapshot.empty) {
          const latestCharacter = {
            id: charactersSnapshot.docs[0].id,
            ...charactersSnapshot.docs[0].data(),
          } as CharacterData;

          setSelectedCharacter(latestCharacter);

          const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
          const sessionsQuery = query(sessionsRef, orderBy('lastMessageTime', 'desc'), limit(1));
          const sessionsSnapshot = await getDocs(sessionsQuery);

          if (!sessionsSnapshot.empty) {
            const latestSession = sessionsSnapshot.docs[0];
            const sessionData = latestSession.data() as ChatSession;
            if (sessionData.characterId === latestCharacter.id) {
              setCurrentSessionId(latestSession.id);
            }
          }
        }
      } catch (error) {
        console.error('[ModernChatV2] Error loading latest data:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadLatestData();
  }, [user, isInitialized]);

  // ─── Listen to messages for current session ───────────────────────────────

  useEffect(() => {
    if (!user || !currentSessionId) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(
      db,
      `users/${user.uid}/chatSessions/${currentSessionId}/messages`
    );
    const q = query(messagesRef, orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      setMessages(fetched);
    });

    return () => unsubscribe();
  }, [user, currentSessionId]);

  // ─── Session management ───────────────────────────────────────────────────

  const createNewSession = async (character: CharacterData): Promise<string | null> => {
    if (!user || !character.id) return null;
    try {
      const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
      const docRef = await addDoc(sessionsRef, {
        name: `Chat with ${character.name}`,
        characterId: character.id,
        characterData: character,
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        messageCount: 0,
      });
      return docRef.id;
    } catch (error) {
      console.error('[ModernChatV2] Error creating session:', error);
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
      console.error('[ModernChatV2] Error updating session:', error);
    }
  };

  // ─── Stop generating ──────────────────────────────────────────────────────

  const stopGenerating = useCallback(() => {
    abortControllerRef.current?.abort();
    setStreamState('cancelled');
    // Flush any pending buffer immediately
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  // ─── Regenerate last response ─────────────────────────────────────────────

  const regenerate = useCallback(async () => {
    if (!user || !selectedCharacter || !currentSessionId) return;

    // Find and delete last AI message
    const lastAiMsg = [...messages].reverse().find((m) => m.character);
    if (!lastAiMsg) return;

    try {
      const msgRef = doc(
        db,
        `users/${user.uid}/chatSessions/${currentSessionId}/messages`,
        lastAiMsg.id
      );
      await deleteDoc(msgRef);

      // Find last user message to repeat
      const lastUserMsg = [...messages].reverse().find((m) => !m.character);
      if (lastUserMsg) {
        const messagesWithoutLast = messages.filter(
          (m) => m.id !== lastAiMsg.id
        );
        await getAIResponse(lastUserMsg.text, currentSessionId, messagesWithoutLast);
      }
    } catch (error) {
      console.error('[ModernChatV2] Error regenerating:', error);
    }
  }, [user, selectedCharacter, currentSessionId, messages]);

  // ─── Buffered Firestore flush ─────────────────────────────────────────────

  const scheduleFlush = useCallback(
    (messageDocId: string, text: string) => {
      if (!user || !currentSessionId) return;

      if (flushTimerRef.current) return; // already scheduled

      flushTimerRef.current = setTimeout(async () => {
        flushTimerRef.current = null;
        try {
          const msgRef = doc(
            db,
            `users/${user.uid}/chatSessions/${currentSessionId}/messages`,
            messageDocId
          );
          await updateDoc(msgRef, { text });
        } catch (e) {
          console.error('[ModernChatV2] Flush error:', e);
        }
      }, 200); // flush every 200ms
    },
    [user, currentSessionId]
  );

  const forceFlush = useCallback(
    async (messageDocId: string, text: string) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (!user || !currentSessionId || !messageDocId) return;
      try {
        const msgRef = doc(
          db,
          `users/${user.uid}/chatSessions/${currentSessionId}/messages`,
          messageDocId
        );
        await updateDoc(msgRef, { text });
      } catch (e) {
        console.error('[ModernChatV2] Force flush error:', e);
      }
    },
    [user, currentSessionId]
  );

  // ─── Robust SSE parser ────────────────────────────────────────────────────

  const parseSSEEvents = (raw: string): SSEEvent[] => {
    const events: SSEEvent[] = [];
    const lines = raw.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        events.push(JSON.parse(payload) as SSEEvent);
      } catch {
        // Partial or malformed JSON — ignore
      }
    }
    return events;
  };

  // ─── Memory extraction (fire-and-forget after turn) ─────────────────────────

  const triggerMemoryExtraction = useCallback(
    async (sessionId: string, currentMessages: Message[]) => {
      if (!user || !selectedCharacter || currentMessages.length < 3) return;
      try {
        fetch('/api/memory/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentMessages,
            characterData: selectedCharacter,
            uid: user.uid,
            sessionId,
          }),
        }).catch(() => {}); // fire-and-forget — ignore errors
      } catch {
        // silent
      }
    },
    [user, selectedCharacter]
  );

  // ─── Observability reporting ───────────────────────────────────────────────

  const reportMetrics = useCallback(
    (metrics: {
      turnId: string;
      sessionId: string;
      firstTokenMs: number;
      totalMs: number;
      promptTokens: number;
      completionTokens: number;
      cachedTokens: number;
      toolCallCount: number;
      toolSuccessCount: number;
      wasInterrupted: boolean;
      streamState: StreamState;
    }) => {
      if (!user || !selectedCharacter) return;
      fetch('/api/observability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metrics,
          characterId: selectedCharacter.id ?? '',
          uid: user.uid,
        }),
      }).catch(() => {}); // fire-and-forget
    },
    [user, selectedCharacter]
  );

  // ─── Core AI response ─────────────────────────────────────────────────────

  const getAIResponse = async (
    userMessage: string,
    sessionId: string,
    historyMessages?: Message[]
  ) => {
    if (!selectedCharacter || !user) return;

    const turnId = `turn-${Date.now()}`;
    const requestStartMs = Date.now();
    let firstTokenMs = 0;
    setActiveTurnId(turnId);
    setActiveToolCalls([]);
    setStreamState('thinking');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let streamingDocRef: ReturnType<typeof doc> | null = null;
    let streamingDocId = '';
    let accumulatedText = '';
    let isFirstContent = true;
    let sseBuffer = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          userMessage,
          characterData: selectedCharacter,
          messages: historyMessages ?? messages,
          turnId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Create the Firestore doc for the streaming message
      const messagesRef = collection(
        db,
        `users/${user.uid}/chatSessions/${sessionId}/messages`
      );
      const docRef = await addDoc(messagesRef, {
        text: '',
        createdAt: serverTimestamp(),
        uid: 'ai',
        photoURL: null,
        displayName: selectedCharacter.name,
        character: true,
      });
      streamingDocRef = doc(
        db,
        `users/${user.uid}/chatSessions/${sessionId}/messages`,
        docRef.id
      );
      streamingDocId = docRef.id;
      streamingMessageIdRef.current = docRef.id;

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No readable stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Accumulate into buffer, then extract complete SSE events
        sseBuffer += decoder.decode(value, { stream: true });
        const boundary = sseBuffer.lastIndexOf('\n\n');
        if (boundary === -1) continue;

        const completePart = sseBuffer.slice(0, boundary + 2);
        sseBuffer = sseBuffer.slice(boundary + 2);

        const events = parseSSEEvents(completePart);

        for (const event of events) {
          if (event.type === 'status') {
            setStreamState(event.state);

          } else if (event.type === 'content') {
            accumulatedText += event.delta;

            // Record first-token latency
            if (isFirstContent) {
              isFirstContent = false;
              firstTokenMs = Date.now() - requestStartMs;
              scrollToBottom(true);
            }

            // Optimistic local update via React state (shows instantly)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingDocId ? { ...m, text: accumulatedText } : m
              )
            );

            // Debounced Firestore write (200ms flush)
            scheduleFlush(streamingDocId, accumulatedText);

          } else if (event.type === 'tool_call') {
            setStreamState('tool-running');
            setActiveToolCalls((prev) => [
              ...prev,
              {
                callId: event.callId,
                name: event.name,
                args: event.args,
                status: 'pending',
                startedAt: Date.now(),
              },
            ]);

          } else if (event.type === 'tool_result') {
            setActiveToolCalls((prev) =>
              prev.map((tc) =>
                tc.callId === event.callId
                  ? { ...tc, result: event.result, status: 'success', durationMs: event.durationMs }
                  : tc
              )
            );

          } else if (event.type === 'error') {
            const errorText = `⚠️ ${event.message}`;
            accumulatedText = errorText;
            await forceFlush(streamingDocId, errorText);
            setStreamState('error');
          }
        }
      }

      // Final flush with complete text
      await forceFlush(streamingDocId, accumulatedText);

      // Fallback if no content received
      if (!accumulatedText.trim() && streamingDocRef) {
        const fallback = "I'm here and ready to chat! How can I help you?";
        await updateDoc(streamingDocRef, { text: fallback });
        accumulatedText = fallback;
      }

      await updateSessionLastMessage(sessionId, accumulatedText.slice(0, 100));

      // Fire-and-forget: extract memories and report observability metrics
      const currentMsgs = [...messages];
      triggerMemoryExtraction(sessionId, currentMsgs);
      reportMetrics({
        turnId,
        sessionId,
        firstTokenMs,
        totalMs: Date.now() - requestStartMs,
        promptTokens: 0, // updated below when meta event arrives
        completionTokens: 0,
        cachedTokens: 0,
        toolCallCount: activeToolCalls.length,
        toolSuccessCount: activeToolCalls.filter((t) => t.status === 'success').length,
        wasInterrupted: false,
        streamState: 'done',
      });

    } catch (error: any) {
      if (error?.name === 'AbortError' || abortController.signal.aborted) {
        // User cancelled — flush whatever we have
        if (streamingDocId && accumulatedText) {
          await forceFlush(streamingDocId, accumulatedText + ' *(stopped)*');
        } else if (streamingDocRef && !accumulatedText) {
          await deleteDoc(streamingDocRef);
        }
        setStreamState('cancelled');
        return;
      }

      console.error('[ModernChatV2] getAIResponse error:', error);

      if (streamingDocRef && !accumulatedText) {
        await deleteDoc(streamingDocRef);
        const errRef = collection(
          db,
          `users/${user.uid}/chatSessions/${sessionId}/messages`
        );
        await addDoc(errRef, {
          text: "I'm sorry, I'm having trouble responding right now. Please try again.",
          createdAt: serverTimestamp(),
          uid: 'ai',
          photoURL: null,
          displayName: selectedCharacter.name,
          character: true,
        });
      }
      setStreamState('error');
    } finally {
      setActiveTurnId(null);
      streamingMessageIdRef.current = null;
      abortControllerRef.current = null;
      // Transition to idle after a short delay so "done" state is visible
      setTimeout(() => setStreamState('idle'), 800);
    }
  };

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSendMessage = async (messageText: string) => {
    if (!user || !selectedCharacter || isStreaming) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createNewSession(selectedCharacter);
      if (!sessionId) return;
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
      const messagesRef = collection(
        db,
        `users/${user.uid}/chatSessions/${sessionId}/messages`
      );
      await addDoc(messagesRef, newMessage);
      await updateSessionLastMessage(sessionId, messageText.slice(0, 100));
      await getAIResponse(messageText, sessionId);
    } catch (error) {
      console.error('[ModernChatV2] handleSendMessage error:', error);
    }
  };

  // ─── Character / session handlers ─────────────────────────────────────────

  const handleCharacterSelect = (character: CharacterData) => {
    setSelectedCharacter(character);
    setCurrentSessionId(null);
    setMessages([]);
    setIsMobileMenuOpen(false);
  };

  const handleSessionSelect = (sessionId: string, characterData: CharacterData) => {
    setCurrentSessionId(sessionId);
    setSelectedCharacter(characterData);
    setIsMobileMenuOpen(false);
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setIsMobileMenuOpen(false);
  };

  const clearCurrentChat = async () => {
    if (!user || !currentSessionId || isStreaming) return;
    try {
      const messagesRef = collection(
        db,
        `users/${user.uid}/chatSessions/${currentSessionId}/messages`
      );
      const snap = await getDocs(query(messagesRef));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      setMessages([]);
    } catch (error) {
      console.error('[ModernChatV2] clearCurrentChat error:', error);
    }
  };

  // ─── Message renderer ─────────────────────────────────────────────────────

  const renderMessage = (msg: Message) => {
    const isCurrentlyStreaming =
      msg.id === streamingMessageIdRef.current && isStreaming;

    return (
      <div
        key={msg.id}
        className={cn(
          'flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 group animate-in slide-in-from-bottom-2 duration-300',
          msg.uid === user?.uid ? 'flex-row-reverse' : ''
        )}
      >
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border-2 border-border flex-shrink-0">
          <AvatarImage src={msg.photoURL || ''} alt={msg.displayName || ''} />
          <AvatarFallback
            className={cn(
              'text-xs font-medium',
              msg.character
                ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                : 'bg-primary text-primary-foreground'
            )}
          >
            {msg.character ? (
              <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </AvatarFallback>
        </Avatar>

        <div
          className={cn(
            'flex flex-col max-w-[85%] sm:max-w-[80%] min-w-0',
            msg.uid === user?.uid ? 'items-end' : 'items-start'
          )}
        >
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

          <div
            className={cn(
              'p-3 sm:p-4 rounded-2xl shadow-sm border transition-all duration-200',
              msg.uid === user?.uid
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-md'
                : 'bg-card text-card-foreground rounded-bl-md hover:shadow-md',
              isCurrentlyStreaming && 'border-purple-400/50 shadow-purple-100/20'
            )}
          >
            <MessageContent content={msg.text} isUser={msg.uid === user?.uid} />
            {isCurrentlyStreaming && (
              <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (!user) {
    return <div>Please sign in to continue</div>;
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-4 w-16 h-16 mx-auto mb-4 animate-pulse">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading your characters...</p>
        </div>
      </div>
    );
  }

  // ─── Whether to show regenerate button ───────────────────────────────────
  const canRegenerate =
    streamState === 'idle' &&
    messages.length > 0 &&
    messages[messages.length - 1]?.character === true;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Character Selector */}
      <div className="hidden lg:block">
        <CharacterSelector
          selectedCharacterId={selectedCharacter?.id || null}
          onCharacterSelect={handleCharacterSelect}
          onNewCharacter={() => {}}
        />
      </div>

      {/* Desktop Chat History */}
      {selectedCharacter && (
        <div className="hidden lg:block">
          <ChatHistory
            currentSessionId={currentSessionId}
            selectedCharacterId={selectedCharacter.id || null}
            onSessionSelect={handleSessionSelect}
            onNewChat={handleNewChat}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] max-w-80 p-0">
                  <SheetHeader className="p-4 border-b bg-card/50 backdrop-blur-sm">
                    <SheetTitle className="text-left">Characters & Chats</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-hidden">
                      <CharacterSelector
                        selectedCharacterId={selectedCharacter?.id || null}
                        onCharacterSelect={handleCharacterSelect}
                        onNewCharacter={() => setIsMobileMenuOpen(false)}
                      />
                    </div>
                    {selectedCharacter && (
                      <div className="border-t max-h-[40%] overflow-hidden">
                        <ChatHistory
                          currentSessionId={currentSessionId}
                          selectedCharacterId={selectedCharacter.id || null}
                          onSessionSelect={handleSessionSelect}
                          onNewChat={handleNewChat}
                        />
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              {selectedCharacter && (
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-border flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm sm:text-base">
                      {selectedCharacter.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-base sm:text-lg truncate">
                      {selectedCharacter.name}
                    </h2>
                    <Badge variant="secondary" className="text-xs">
                      {selectedCharacter.profession}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {canRegenerate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={regenerate}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  title="Regenerate response"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              {/* Live Mode toggle */}
              {selectedCharacter && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsLiveModeOpen(true)}
                  disabled={isStreaming}
                  className="h-8 w-8 sm:h-9 sm:w-9 text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  title="Live voice mode"
                >
                  <Headphones className="h-4 w-4" />
                </Button>
              )}
              {currentSessionId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearCurrentChat}
                  disabled={isStreaming}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <SignOutButton />
            </div>
          </div>

          {/* Stream Status Bar */}
          {selectedCharacter && (
            <StreamStatusBar
              streamState={streamState}
              activeToolName={activeToolCalls.find((t) => t.status === 'pending')?.name}
              characterName={selectedCharacter.name}
            />
          )}
        </div>

        {/* Messages Area */}
        <div
          ref={scrollContainerRef as React.RefObject<HTMLDivElement>}
          className="flex-1 overflow-y-auto p-3 sm:p-6"
        >
          {!selectedCharacter ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-4 sm:p-6 mb-4 sm:mb-6 shadow-lg animate-pulse">
                <Bot className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Welcome to AI Character Chat
              </h3>
              <p className="text-muted-foreground mb-4 sm:mb-6 max-w-md text-sm sm:text-base">
                Select a character from the sidebar or create a new one to start chatting.
              </p>
              <Button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden gap-2"
                size="sm"
              >
                <Bot className="h-4 w-4" />
                Browse Characters
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 mb-4 border-4 border-border shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-lg sm:text-2xl">
                  {selectedCharacter.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                Chat with {selectedCharacter.name}
              </h3>
              <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                Start a conversation with your AI character
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <Badge variant="outline" className="text-xs">
                  {selectedCharacter.profession}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {selectedCharacter.tone}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Age {selectedCharacter.age}
                </Badge>
              </div>
              {selectedCharacter.description && (
                <div className="bg-card/50 rounded-lg p-4 max-w-md border">
                  <p className="text-sm text-muted-foreground">{selectedCharacter.description}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        {selectedCharacter && (
          <div className="border-t border-border bg-card/50 backdrop-blur-sm p-3 sm:p-4 sticky bottom-0">
            <ChatInput
              onSendMessage={handleSendMessage}
              onStop={stopGenerating}
              streamState={streamState}
            />
          </div>
        )}
      </div>

      {/* Live Mode Dialog */}
      {selectedCharacter && (
        <Dialog open={isLiveModeOpen} onOpenChange={setIsLiveModeOpen}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Live Voice Mode
                </span>
                <span className="text-muted-foreground text-sm font-normal">
                  — {selectedCharacter.name}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="h-[480px]">
              <LiveModePanel
                characterData={selectedCharacter}
                onTranscript={(text, role) => {
                  // Optionally log transcripts to console for debugging
                  console.debug('[LiveMode transcript]', role, text);
                }}
                onClose={() => setIsLiveModeOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}