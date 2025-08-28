"use client";
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import SignInForm from './(auth)/signin/page';
import { useEffect, useState, useRef } from 'react';
import MainInterface from '@/components/MainInterface';
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import {
  Button
} from '@/components/ui/button';
import {
  DialogFooter
} from '@/components/ui/dialog';
import { Sparkles, Bot } from 'lucide-react';

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
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <Card className="max-w-md mx-4 border-border shadow-2xl">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Welcome to CharacterVerse!
                </CardTitle>
                <div className="space-y-3 text-muted-foreground">
                  <p>You are invited by <span className="font-semibold text-foreground">AYAN MANDAL</span>.</p>
                  <p>
                    This is an early implementation of CharacterVerse. Create unique AI characters and engage in meaningful conversations.
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ The AI may sometimes generate inappropriate responses.
                  </p>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button onClick={onClose} className="w-full gap-2" size="lg">
                  <Sparkles className="h-4 w-4" />
                  Let's Go!
                </Button>
              </DialogFooter>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default function Home() {
  const [user, loading, error] = useAuthState(auth);
  const [showIntroDialog, setShowIntroDialog] = useState(false);

  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('introDialogShown');
    if (!hasSeenIntro && !user) {
      setShowIntroDialog(true);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-4 w-16 h-16 mx-auto mb-4 animate-pulse">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Card className="max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-destructive mb-2">Error</h2>
            <p className="text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
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
    return <MainInterface />;
  }

  return <SignInForm />;
}