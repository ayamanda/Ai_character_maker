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
    deleteDoc
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { 
    Briefcase, 
    RefreshCcw, 
    Trash2, 
    UserCog, 
    Info, 
    Settings, 
    Zap 
} from 'lucide-react';
import ChatInput from './ChatInput';
import { CharacterData, Message } from '@/types';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function Chat() {
    const [user] = useAuthState(auth);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [characterData, setCharacterData] = useState<CharacterData | null>(null);
    const router = useRouter();
    const [initialLoad, setInitialLoad] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    useEffect(() => {
        const storedCharacterData = localStorage.getItem('characterData');
        if (storedCharacterData) {
            setCharacterData(JSON.parse(storedCharacterData));
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        const messagesRef = collection(db, `users/${user.uid}/messages`);
        const q = query(messagesRef, orderBy('createdAt'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages: Message[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            } as Message));
            setMessages(fetchedMessages);
            setError(null);
            setInitialLoad(false);
        }, (err) => {
            console.error("Error fetching messages:", err);
            setError(err.message);
        });
        return () => unsubscribe();
    }, [user]);

    const getAIResponse = async (userMessage: string) => {
        if (!characterData || !user) {
            setError("Character data or user not available.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage, characterData, messages }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            const aiResponse = data.choices[0].message?.content || "No response from AI";

            const newMessage: Omit<Message, 'id'> = {
                text: aiResponse,
                createdAt: serverTimestamp(),
                uid: 'ai',
                photoURL: null,
                displayName: characterData.name,
                character: true,
            };

            const messagesRef = collection(db, `users/${user.uid}/messages`);
            await addDoc(messagesRef, newMessage);

        } catch (error: any) {
            console.error('Error fetching AI response:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (messageText: string) => {
        if (!user || !characterData) return;

        const newMessage: Omit<Message, 'id'> = {
            text: messageText,
            createdAt: serverTimestamp(),
            uid: user.uid,
            photoURL: user.photoURL,
            displayName: user.displayName,
            character: false,
        };

        try {
            const messagesRef = collection(db, `users/${user.uid}/messages`);
            await addDoc(messagesRef, newMessage);
            getAIResponse(messageText);

        } catch (error: any) {
            console.error("Error adding message:", error);
            setError(error.message);
        }
    };

    const handleClearMessages = async () => {
        if (!user) return;

        const messagesRef = collection(db, `users/${user.uid}/messages`);
        const q = query(messagesRef);
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
        });
        setMessages([]);
        setIsMobileMenuOpen(false);
    };

    const handleModifyCharacter = () => {
        router.push('/');
        setIsMobileMenuOpen(false);
    };

    const handleRefresh = () => {
        const storedCharacterData = localStorage.getItem('characterData');
        if (storedCharacterData) {
            setCharacterData(JSON.parse(storedCharacterData));
        } else {
            setError("Character data not found.");
        }
        setIsMobileMenuOpen(false);
    }

    return (
        <div className="flex flex-col h-screen  max-h-screen overflow-hidden">
            {/* Desktop Actions in Top Left */}
            <div className="hidden md:flex absolute top-4 left-4 space-x-2 items-center z-20 bg-background/50 backdrop-blur-md rounded-lg p-1 border shadow-sm">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={handleRefresh}
                                className="hover:bg-accent/50 transition-colors"
                            >
                                <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Refresh Character</p>
                        </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={handleClearMessages}
                                className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                                <Trash2 className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Clear Messages</p>
                        </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={handleModifyCharacter}
                                className="hover:bg-accent/50 transition-colors"
                            >
                                <UserCog className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Modify Character</p>
                        </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setIsInfoModalOpen(true)}
                                className="hover:bg-accent/50 transition-colors"
                            >
                                <Info className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Character Info</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Character Info Header */}
            {characterData && (
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center space-x-2">
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                        <Badge variant="secondary" className="truncate max-w-[200px]">
                            {characterData.name} ({characterData.profession})
                        </Badge>
                    </div>
                    
                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            <UserCog className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive" className="m-2">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4 space-y-4 overflow-y-auto">
                {initialLoad ? (
                    <p className="text-center text-muted-foreground">Loading messages...</p>
                ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                        No messages yet. Start a conversation!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div 
                            key={msg.id} 
                            className={`flex items-start gap-2 mb-4 ${msg.uid === user?.uid ? 'flex-row-reverse' : ''}`}
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={msg.photoURL || ''} alt={msg.displayName || ''} />
                                <AvatarFallback>
                                    {msg.uid === 'ai' ? 'AI' : msg.displayName?.slice(0, 2) || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div 
                                className={`
                                    p-3 rounded-lg max-w-[80%]
                                    ${msg.uid === user?.uid 
                                        ? 'bg-blue-500 text-white ml-auto' 
                                        : 'bg-gray-100 text-black mr-auto'}
                                `}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}

                {isLoading && (
                    <div className="flex items-start gap-2 animate-pulse">
                        <Avatar>
                            <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className="bg-gray-200 p-3 rounded-lg">
                            <Skeleton className="h-4 w-[150px]" />
                        </div>
                    </div>
                )}
            </ScrollArea>

            {/* Chat Input */}
            <div className="p-4 border-t flex items-center space-x-2">
                <ChatInput 
                    onSendMessage={handleSendMessage} 
                    isLoading={isLoading} 
                />
            </div>

            {/* Mobile Actions Dialog */}
            <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Chat Actions</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Button 
                            onClick={handleRefresh} 
                            className="w-full"
                        >
                            <RefreshCcw className="mr-2 h-5 w-5" /> Refresh Character
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleClearMessages} 
                            className="w-full"
                        >
                            <Trash2 className="mr-2 h-5 w-5" /> Clear Messages
                        </Button>
                        <Button 
                            variant="secondary" 
                            onClick={handleModifyCharacter} 
                            className="w-full"
                        >
                            <UserCog className="mr-2 h-5 w-5" /> Modify Character
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Character Info Modal */}
            <Dialog open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Character Details</DialogTitle>
                    </DialogHeader>
                    {characterData && (
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <Zap className="h-6 w-6 text-yellow-500" />
                                <div>
                                    <p className="font-semibold">Name</p>
                                    <p className="text-muted-foreground">{characterData.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Settings className="h-6 w-6 text-blue-500" />
                                <div>
                                    <p className="font-semibold">Profession</p>
                                    <p className="text-muted-foreground">{characterData.profession}</p>
                                </div>
                            </div>
                            {characterData.description && (
                                <div className="flex items-start gap-4">
                                    <Info className="h-6 w-6 text-green-500 mt-1" />
                                    <div>
                                        <p className="font-semibold">Description</p>
                                        <p className="text-muted-foreground">{characterData.description}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default Chat;