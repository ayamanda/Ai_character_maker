import {
  Button
} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogFooter
} from '@/components/ui/dialog';
import { useEffect, useRef } from 'react';

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
      <Dialog>
        <Card className="max-w-md">
          <CardTitle className="text-center">Welcome!</CardTitle>
          <CardContent>
              <p>You are invited by AYAN MANDAL.</p>
              <p>This is an early implementation of CharacterVerse. The AI may sometimes generate inappropriate responses.</p>
          </CardContent>
          <DialogFooter>
              <Button onClick={onClose}>Let's Go!</Button>
          </DialogFooter>
        </Card>
      </Dialog>)}
    </>
  );
};

export default IntroductionDialog;