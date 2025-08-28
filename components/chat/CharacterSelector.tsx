'use client';
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '@/lib/firebase';
import { CharacterData } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Plus,
  Bot,
  Trash2,
  Edit,
  Clock,
  User,
  Briefcase,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import CharacterForm from '@/components/CharacterForm';

interface CharacterSelectorProps {
  selectedCharacterId: string | null;
  onCharacterSelect: (character: CharacterData) => void;
  onNewCharacter: () => void;
}

export default function CharacterSelector({
  selectedCharacterId,
  onCharacterSelect,
  onNewCharacter,
}: CharacterSelectorProps) {
  const [user] = useAuthState(auth);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null);

  useEffect(() => {
    if (!user) return;

    const charactersRef = collection(db, `users/${user.uid}/characters`);
    const q = query(charactersRef, orderBy('lastUsed', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCharacters = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as CharacterData)
      );
      setCharacters(fetchedCharacters);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);



  const deleteCharacter = async (characterId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/characters`, characterId));
    } catch (error) {
      console.error('Error deleting character:', error);
    }
  };

  const selectCharacter = async (character: CharacterData) => {
    if (!user || !character.id) return;

    try {
      // Update lastUsed timestamp
      const characterRef = doc(db, `users/${user.uid}/characters`, character.id);
      await updateDoc(characterRef, {
        lastUsed: serverTimestamp(),
      });

      onCharacterSelect(character);
    } catch (error) {
      console.error('Error selecting character:', error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleNewCharacter = () => {
    setEditingCharacter(null);
    setShowCharacterForm(true);
    onNewCharacter();
  };

  const handleEditCharacter = (character: CharacterData) => {
    setEditingCharacter(character);
    setShowCharacterForm(true);
  };

  const handleCloseForm = () => {
    setShowCharacterForm(false);
    setEditingCharacter(null);
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-card border-r border-border p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Characters</h2>
          <Button
            onClick={handleNewCharacter}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {/* Characters List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {characters.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">No characters yet</p>
              <p className="text-sm">Create your first AI character to start chatting</p>
              <Button
                onClick={handleNewCharacter}
                className="mt-4 gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Create Character
              </Button>
            </div>
          ) : (
            characters.map((character) => (
              <div
                key={character.id}
                className={cn(
                  "group relative p-3 sm:p-4 rounded-lg cursor-pointer transition-all duration-200 hover:bg-accent border touch-manipulation",
                  selectedCharacterId === character.id
                    ? "bg-accent border-primary shadow-sm ring-1 ring-primary/20"
                    : "border-transparent hover:border-border"
                )}
                onClick={() => selectCharacter(character)}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-border flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-medium text-sm">
                      {character.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">
                        {character.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        {character.age}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 mb-2">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">
                        {character.profession}
                      </span>
                    </div>

                    <Badge variant="outline" className="text-xs mb-2">
                      {character.tone}
                    </Badge>

                    {character.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {character.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Last used {formatTime(character.lastUsed)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-7 sm:w-7 touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCharacter(character);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:text-destructive touch-manipulation"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Character</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {character.name}?
                            This will also delete all chat sessions with this character.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => character.id && deleteCharacter(character.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Character Form Dialog */}
      <Dialog open={showCharacterForm} onOpenChange={setShowCharacterForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCharacter ? 'Edit Character' : 'Create New Character'}
            </DialogTitle>
          </DialogHeader>
          <CharacterForm
            character={editingCharacter}
            onClose={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}