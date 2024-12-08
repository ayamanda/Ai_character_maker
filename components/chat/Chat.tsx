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
import ChatInput from './ChatInput';
import { CharacterData, Message } from '@/types';
import { useRouter } from 'next/navigation';


function Chat() {
    const [user] = useAuthState(auth);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [characterData, setCharacterData] = useState<CharacterData | null>(null);
    const router = useRouter();
    const [initialLoad, setInitialLoad] = useState(true); // track initial load



    useEffect(() => {
        const storedCharacterData = localStorage.getItem('characterData');
        if (storedCharacterData) {
            setCharacterData(JSON.parse(storedCharacterData));
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        const messagesRef = collection(db, `users/${user.uid}/messages`);
        const q = query(messagesRef, orderBy('createdAt')); //Removed limit to show all messages

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages: Message[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            } as Message));
            setMessages(fetchedMessages);
            setError(null);
            setInitialLoad(false); //Set initial load to false after first load
        }, (err) => {
            console.error("Error fetching messages:", err);
            setError(err.message);
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


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
    };

    const handleModifyCharacter = () => {
        router.push('/');
    };

    const handleRefresh = () => {
        const storedCharacterData = localStorage.getItem('characterData');
        if (storedCharacterData) {
            setCharacterData(JSON.parse(storedCharacterData));
        } else {
            setError("Character data not found.");
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {characterData && (
                    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md p-4">
                        <Badge variant="secondary">
                            Chatting with: {characterData.name} ({characterData.profession})
                        </Badge>
                    </div>
                )}
                {initialLoad && <p>Loading...</p>} {!initialLoad && messages.map((msg) => (
                    <div key={msg.id} className={`flex items-start gap-2 ${msg.uid === user?.uid ? 'justify-end' : 'justify-start'}`}>
                        {msg.uid !== user?.uid && (
                            <Avatar>
                                <AvatarImage src={msg.photoURL || ''} alt={msg.displayName || ''} />
                                <AvatarFallback>{msg.displayName ? msg.displayName.slice(0, 2) : 'AI'}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={`p-3 rounded-lg ${msg.uid === user?.uid ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                            {msg.text}
                        </div>
                        {msg.uid === user?.uid && (
                            <Avatar>
                                <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
                                <AvatarFallback>{user?.displayName ? user.displayName.slice(0, 2) : 'U'}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}


                {isLoading && (
                    <div className="flex items-start gap-2 animate-pulse">
                        <Avatar>
                            <AvatarImage src="" alt="AI" />
                            <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className="bg-gray-200 p-3 rounded-lg">
                            <Skeleton className="h-4 w-[150px]" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t flex justify-between items-center">
                <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
                <div className="flex gap-2">
                    <Button onClick={handleClearMessages}>Clear Messages</Button>
                    <Button onClick={handleModifyCharacter}>Modify Character</Button>
                    <Button onClick={handleRefresh}>Refresh</Button>
                </div>
            </div>
        </div>
    );
}

export default Chat;