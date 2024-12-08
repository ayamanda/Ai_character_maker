'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  deleteDoc,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { useMediaQuery } from 'react-responsive';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '@/lib/firebase';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  RefreshCcw,
  Trash2,
  UserCog,
  Menu,
  Info,
  Settings,
  Zap,
} from 'lucide-react';
import ChatInput from './ChatInput';
import { CharacterData, Message } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import SignOutButton from '@/components/SignOutButton';
import CharacterForm from '@/components/CharacterForm';

function Chat() {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characterData, setCharacterData] = useState<CharacterData | null>(
    null
  );
  const [initialLoad, setInitialLoad] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMobile = useMediaQuery({ maxWidth: 767 });

  // Memoized character data from local storage
  const storedCharacterData = useMemo(() => {
    const data = localStorage.getItem('characterData');
    return data ? JSON.parse(data) : null;
  }, []);

  useEffect(() => {
    setCharacterData(storedCharacterData);
  }, [storedCharacterData]);

  // Fetch messages from Firestore
  useEffect(() => {
    if (!user) return;
    const messagesRef = collection(db, `users/${user.uid}/messages`);
    const q = query(messagesRef, orderBy('createdAt'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedMessages = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Message)
        );
        setMessages(fetchedMessages);
        setError(null);
        setInitialLoad(false);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError(err.message);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Scroll to the bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to get AI response
  const getAIResponse = async (userMessage: string) => {
    if (!characterData || !user) {
      setError('Character data or user not available.');
      return;
    }

    setIsLoading(true);
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
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `HTTP error! status: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();
      const aiResponse =
        data.choices[0].message?.content || 'No response from AI';

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

  // Function to handle sending a message
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
      await getAIResponse(messageText);
    } catch (error: any) {
      console.error('Error adding message:', error);
      setError(error.message);
    }
  };

  // Function to handle clearing messages
  const handleClearMessages = async () => {
    if (!user) return;

    setIsLoading(true);
    const messagesRef = collection(db, `users/${user.uid}/messages`);
    const querySnapshot = await getDocs(query(messagesRef));

    const deletePromises = querySnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    try {
      await Promise.all(deletePromises);
      setMessages([]);
    } catch (error: any) {
      console.error('Error clearing messages:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
      setIsMobileMenuOpen(false);
    }
  };

  // Function to handle modifying character
  const handleModifyCharacter = () => {
    setShowCharacterForm(true);
    setIsMobileMenuOpen(false);
  };

  // Function to handle character update
  const handleCharacterUpdate = (data: CharacterData) => {
    setCharacterData(data);
    setShowCharacterForm(false);
  };

  // Function to handle refresh character
  const handleRefresh = () => {
    setCharacterData(storedCharacterData);
    setIsMobileMenuOpen(false);
  };

  // Function to render messages
  const renderMessages = () => {
    if (initialLoad) {
      return (
        <p className="text-center text-gray-500">Loading messages...</p>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="text-center text-gray-500">
          No messages yet. Start a conversation!
        </div>
      );
    }

    return messages.map((msg) => (
      <div
        key={msg.id}
        className={`flex items-start gap-2 mb-4 ${
          msg.uid === user?.uid ? 'flex-row-reverse' : ''
        }`}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={msg.photoURL || ''}
            alt={msg.displayName || ''}
          />
          <AvatarFallback>
            {msg.uid === 'ai' ? 'AI' : msg.displayName?.slice(0, 2) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div
          className={`
                  p-3 rounded-lg max-w-[80%] shadow-sm
                  ${
                    msg.uid === user?.uid
                      ? 'bg-gray-800 text-white ml-auto'
                      : 'bg-gray-100 text-black mr-auto'
                  }
                `}
        >
          {msg.text}
        </div>
      </div>
    ));
  };

  // Mobile UI
  const renderMobileUI = () => (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-white p-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2">
          {characterData && (
            <>
              <Briefcase className="h-5 w-5 text-gray-600" />
              <Badge
                variant="secondary"
                className="truncate max-w-[150px]"
              >
                {characterData.name}
              </Badge>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="m-2">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-100">
        {renderMessages()}

        {isLoading && (
          <div className="flex items-start gap-2 animate-pulse">
            <Avatar className="h-8 w-8">
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <div className="bg-gray-200 p-3 rounded-lg shadow-sm">
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>

      {/* Mobile Actions Dialog */}
      <Dialog
        open={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Chat Actions</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              onClick={handleRefresh}
              className="w-full justify-start"
            >
              <RefreshCcw className="mr-2 h-5 w-5" /> Refresh
              Character
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearMessages}
              className="w-full justify-start"
            >
              <Trash2 className="mr-2 h-5 w-5" /> Clear Messages
            </Button>
            <Button
              variant="secondary"
              onClick={handleModifyCharacter}
              className="w-full justify-start"
            >
              <UserCog className="mr-2 h-5 w-5" /> Modify Character
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsInfoModalOpen(true)}
              className="w-full justify-start"
            >
              <Info className="mr-2 h-5 w-5" /> Character Info
            </Button>
            <SignOutButton />
          </div>
        </DialogContent>
      </Dialog>

      {/* Character Info Modal */}
      <Dialog
        open={isInfoModalOpen}
        onOpenChange={setIsInfoModalOpen}
      >
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
                  <p className="text-gray-600">
                    {characterData.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Settings className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="font-semibold">Profession</p>
                  <p className="text-gray-600">
                    {characterData.profession}
                  </p>
                </div>
              </div>
              {characterData.description && (
                <div className="flex items-start gap-4">
                  <Info className="h-6 w-6 text-green-500 mt-1" />
                  <div>
                    <p className="font-semibold">Description</p>
                    <p className="text-gray-600">
                      {characterData.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={showCharacterForm}
        onOpenChange={setShowCharacterForm}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Character</DialogTitle>
          </DialogHeader>
          <CharacterForm onCharacterSubmit={handleCharacterUpdate} />
        </DialogContent>
      </Dialog>
    </div>
  );

  // Desktop UI
  const renderDesktopUI = () => (
    <div className="flex flex-col h-screen mx-auto bg-white shadow-lg">
      {/* Desktop Header */}
      <div className="bg-gray-200 py-2 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {characterData && (
            <>
              <Briefcase className="h-5 w-5 text-gray-600" />
              <Badge variant="secondary" className="truncate">
                {characterData.name} ({characterData.profession})
              </Badge>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  className="hover:bg-gray-300"
                >
                  <RefreshCcw className="h-4 w-4 text-gray-600" />
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
                  className="hover:bg-gray-300"
                >
                  <Trash2 className="h-4 w-4 text-gray-600" />
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
                  className="hover:bg-gray-300"
                >
                  <UserCog className="h-4 w-4 text-gray-600" />
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
                  className="hover:bg-gray-300"
                >
                  <Info className="h-4 w-4 text-gray-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Character Info</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <SignOutButton />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="m-2">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 space-y-4 overflow-y-auto">
        {renderMessages()}

        {isLoading && (
          <div className="flex items-start gap-2 animate-pulse">
            <Avatar className="h-8 w-8">
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <div className="bg-gray-200 p-3 rounded-lg shadow-sm">
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-200">
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>

      {/* Character Info Modal */}
      <Dialog
        open={isInfoModalOpen}
        onOpenChange={setIsInfoModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Character Details</DialogTitle>
          </DialogHeader>
          {characterData && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Zap className="h-6 w-6 text-yellow-500" />
                <div>
                  <p className="font-semibold">Name</p>
                  <p className="text-gray-600">
                    {characterData.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Settings className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="font-semibold">Profession</p>
                  <p className="text-gray-600">
                    {characterData.profession}
                  </p>
                </div>
              </div>
              {characterData.description && (
                <div className="flex items-start gap-4">
                  <Info className="h-6 w-6 text-green-500 mt-1" />
                  <div>
                    <p className="font-semibold">Description</p>
                    <p className="text-gray-600">
                      {characterData.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={showCharacterForm}
        onOpenChange={setShowCharacterForm}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Character</DialogTitle>
          </DialogHeader>
          <CharacterForm onCharacterSubmit={handleCharacterUpdate} />
        </DialogContent>
      </Dialog>
    </div>
  );

  // Render based on screen size
  return isMobile ? renderMobileUI() : renderDesktopUI();
}

export default Chat;