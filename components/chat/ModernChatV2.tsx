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
    limit,
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '@/lib/firebase';
import { CharacterData, Message, ChatSession } from '@/types';
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
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

export default function ModernChatV2() {
    const [user] = useAuthState(auth);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load the most recent character and session on mount
    useEffect(() => {
        if (!user || isInitialized) return;

        const loadLatestData = async () => {
            try {
                // Get the most recently used character
                const charactersRef = collection(db, `users/${user.uid}/characters`);
                const charactersQuery = query(charactersRef, orderBy('lastUsed', 'desc'), limit(1));
                const charactersSnapshot = await getDocs(charactersQuery);

                if (!charactersSnapshot.empty) {
                    const latestCharacter = {
                        id: charactersSnapshot.docs[0].id,
                        ...charactersSnapshot.docs[0].data()
                    } as CharacterData;

                    setSelectedCharacter(latestCharacter);

                    // Get the most recent session for this character
                    const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
                    const sessionsQuery = query(sessionsRef, orderBy('lastMessageTime', 'desc'), limit(1));
                    const sessionsSnapshot = await getDocs(sessionsQuery);

                    if (!sessionsSnapshot.empty) {
                        const latestSession = sessionsSnapshot.docs[0];
                        const sessionData = latestSession.data() as ChatSession;

                        // Only load if it's for the same character
                        if (sessionData.characterId === latestCharacter.id) {
                            setCurrentSessionId(latestSession.id);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading latest data:', error);
            } finally {
                setIsInitialized(true);
            }
        };

        loadLatestData();
    }, [user, isInitialized]);

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

    // Auto-scroll to bottom with improved logic
    useEffect(() => {
        const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        };

        // Always scroll on new messages, with a slight delay for better UX
        const timeoutId = setTimeout(scrollToBottom, 100);

        return () => clearTimeout(timeoutId);
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
        if (!selectedCharacter || !user || !targetSessionId) {
            console.error('Missing required data for AI response:', { selectedCharacter, user, targetSessionId });
            return;
        }

        console.log('Starting AI response for message:', userMessage);
        setIsLoading(true);
        let streamingMessageRef: any = null;
        let accumulatedText = '';

        try {
            console.log('Sending request to API with data:', {
                userMessage,
                characterData: selectedCharacter,
                messagesCount: messages.length,
            });

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userMessage,
                    characterData: selectedCharacter,
                    messages,
                }),
            });

            console.log('API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
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
            console.log('Created streaming message ref:', streamingMessageRef.id);

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                console.log('Starting to read stream...');
                setIsStreaming(true);
                let isFirstChunk = true;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        console.log('Stream reading completed');
                        setIsStreaming(false);
                        break;
                    }

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data === '[DONE]') {
                                console.log('Received DONE signal');
                                setIsStreaming(false);
                                break;
                            }

                            if (data) {
                                try {
                                    const parsed = JSON.parse(data);
                                    if (parsed.content) {
                                        accumulatedText += parsed.content;

                                        // Update the message in Firestore
                                        await updateDoc(streamingMessageRef, {
                                            text: accumulatedText,
                                        });
                                        console.log('Updated message with accumulated text length:', accumulatedText.length);

                                        // Auto-scroll on first chunk to ensure visibility
                                        if (isFirstChunk) {
                                            isFirstChunk = false;
                                            setTimeout(() => {
                                                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                            }, 100);
                                        }
                                    } else if (parsed.error) {
                                        console.error('Stream error:', parsed.error);
                                        throw new Error(parsed.error);
                                    }
                                } catch (e) {
                                    console.warn('Failed to parse JSON:', data, e);
                                }
                            }
                        }
                    }
                }
            }

            console.log('Final accumulated text:', accumulatedText);

            // If no content was received, add a fallback message
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
                console.log('Deleting empty streaming message');
                await deleteDoc(streamingMessageRef);

                // Add error message for user
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
            setIsStreaming(false);
        }
    };

    const handleSendMessage = async (messageText: string) => {
        if (!user || !selectedCharacter) return;

        let sessionId = currentSessionId;

        // Create new session if none exists
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
            const messagesRef = collection(db, `users/${user.uid}/chatSessions/${sessionId}/messages`);
            await addDoc(messagesRef, newMessage);
            await updateSessionLastMessage(sessionId, messageText.slice(0, 100));
            await getAIResponse(messageText, sessionId);
        } catch (error: any) {
            console.error('Error adding message:', error);
        }
    };

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

    const renderMessage = (msg: Message) => {
        console.log('🔥 renderMessage called with:', {
            id: msg.id,
            text: msg.text,
            textLength: msg.text?.length,
            hasStars: msg.text?.includes?.('**'),
            uid: msg.uid,
            character: msg.character
        });
        return (
            <div
                key={msg.id}
                className={cn(
                    "flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 group animate-in slide-in-from-bottom-2 duration-300",
                    msg.uid === user?.uid ? "flex-row-reverse" : ""
                )}
            >
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border-2 border-border flex-shrink-0">
                    <AvatarImage src={msg.photoURL || ''} alt={msg.displayName || ''} />
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
    };

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

    // Debug logging for messages
    console.log('🚨 MAIN COMPONENT RENDER - Messages:', messages.length);
    console.log('� MAIsN COMPONENT RENDER - Messages array:', messages);

    return (
        <div className="flex h-screen bg-background">
            {/* Desktop Character Selector */}
            <div className="hidden lg:block">
                <CharacterSelector
                    selectedCharacterId={selectedCharacter?.id || null}
                    onCharacterSelect={handleCharacterSelect}
                    onNewCharacter={() => { }}
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
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center justify-between p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                            {/* Mobile Menu Button */}
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
                                        <h2 className="font-semibold text-base sm:text-lg truncate">{selectedCharacter.name}</h2>
                                        <Badge variant="secondary" className="text-xs">
                                            {selectedCharacter.profession}
                                        </Badge>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                            {currentSessionId && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={clearCurrentChat}
                                    disabled={isLoading}
                                    className="h-8 w-8 sm:h-9 sm:w-9"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            <SignOutButton />
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-3 sm:p-6">
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
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                    <Button
                                        onClick={() => setIsMobileMenuOpen(true)}
                                        className="lg:hidden gap-2"
                                        size="sm"
                                    >
                                        <Bot className="h-4 w-4" />
                                        Browse Characters
                                    </Button>
                                </div>
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
                                        <p className="text-sm text-muted-foreground">
                                            {selectedCharacter.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map(renderMessage)}

                                {isLoading && !isStreaming && messages.length > 0 && !messages[messages.length - 1]?.character && (
                                    <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 animate-in slide-in-from-bottom-2 duration-300">
                                        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border-2 border-border">
                                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                                                <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="bg-card border rounded-2xl rounded-bl-md p-3 sm:p-4 shadow-sm">
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

                                {isStreaming && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                                        <Avatar className="h-5 w-5 border border-border">
                                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                                                <Bot className="h-2.5 w-2.5" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <span>{selectedCharacter?.name} is typing...</span>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* Chat Input */}
                {selectedCharacter && (
                    <div className="border-t border-border bg-card/50 backdrop-blur-sm p-3 sm:p-4 sticky bottom-0">
                        <ChatInput
                            onSendMessage={handleSendMessage}
                            isLoading={isLoading}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}