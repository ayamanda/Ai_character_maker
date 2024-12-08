"use client";
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import CharacterForm from '@/components/CharacterForm';
import SignInForm from './(auth)/signin/page';
import { useEffect, useState, useRef } from 'react';
import Chat from './(chat)/chat/page';
import { CharacterData } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Button
} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import {
  DialogFooter
} from '@/components/ui/dialog';

const IntroductionDialog = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const modalRef = useRef(null);
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscapeKey);
    }
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <Card className="max-w-md p-4">
            <CardTitle className="text-xl font-bold mb-2 text-center">Welcome!</CardTitle>
            <CardContent>
              <p>You are invited by AYAN MANDAL.</p>
              <p>
                This is an early implementation of CharacterVerse. The AI may sometimes generate inappropriate
                responses.
              </p>
            </CardContent>
            <DialogFooter>
              <Button onClick={onClose}>Let's Go!</Button>
            </DialogFooter>
          </Card>
        </div>
      )}
    </>
  );
};

export default function Home() {
  const [user, loading, error] = useAuthState(auth);
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showIntroDialog, setShowIntroDialog] = useState(false);

  useEffect(() => {
    const storedCharacterData = localStorage.getItem('characterData');
    if (storedCharacterData) {
      setCharacterData(JSON.parse(storedCharacterData));
      setShowChat(true);
    }
    const hasSeenIntro = localStorage.getItem('introDialogShown');
    if (!hasSeenIntro && !user) {
      setShowIntroDialog(true);
    }
  }, [user]);

  const handleCharacterUpdate = (data: CharacterData) => {
    setCharacterData(data);
    setShowChat(true);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!user && showIntroDialog) {
    return (
      <IntroductionDialog
        isOpen={showIntroDialog}
        onClose={() => {
          setShowIntroDialog(false);
          localStorage.setItem('introDialogShown', 'true');
        }}
      />
    );
  }

  if (user) {
    return (
      <div className="flex flex-col h-screen">
        {!showChat && (
          <main className="container mx-auto p-4 h-screen flex flex-col">
            <CharacterForm onCharacterSubmit={handleCharacterUpdate} />
            {!showChat && !characterData && (
              <Alert variant="default" className="mt-4">
                <AlertTitle>Create Your Character!</AlertTitle>
                <AlertDescription>Please define your character to start chatting.</AlertDescription>
              </Alert>
            )}
          </main>
        )}
        {showChat && characterData && <Chat />}
      </div>
    );
  }

  return <SignInForm />;
}