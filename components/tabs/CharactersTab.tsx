'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { CharacterData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Search, 
  Bot, 
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Copy
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CharacterForm from '@/components/CharacterForm';

interface CharactersTabProps {
  onCharacterSelect: (character: CharacterData) => void;
}

export default function CharactersTab({ onCharacterSelect }: CharactersTabProps) {
  const [user] = useAuthState(auth);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null);

  // Load characters
  useEffect(() => {
    if (!user) return;

    const charactersRef = collection(db, `users/${user.uid}/characters`);
    const q = query(charactersRef, orderBy('lastUsed', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCharacters = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CharacterData));
      setCharacters(fetchedCharacters);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter characters based on search
  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    character.profession.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCharacterClick = async (character: CharacterData) => {
    // Update lastUsed timestamp
    if (user && character.id) {
      try {
        const characterRef = doc(db, `users/${user.uid}/characters`, character.id);
        await updateDoc(characterRef, {
          lastUsed: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating lastUsed:', error);
      }
    }
    
    onCharacterSelect(character);
  };

  const handleNewCharacter = () => {
    setEditingCharacter(null);
    setShowCharacterForm(true);
  };

  const handleEditCharacter = (character: CharacterData) => {
    setEditingCharacter(character);
    setShowCharacterForm(true);
  };

  const formatLastUsed = (timestamp: any) => {
    if (!timestamp) return 'Never';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-4 w-16 h-16 mx-auto mb-4 animate-pulse">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading characters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Your Characters</h1>
          <Button onClick={handleNewCharacter} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New
          </Button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Characters Grid */}
      <ScrollArea className="flex-1 p-4">
        {filteredCharacters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-6 mb-6 shadow-lg">
              <Bot className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Characters Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create your first AI character to start having amazing conversations. Each character has their own unique personality!
            </p>
            <Button onClick={handleNewCharacter} className="gap-2" size="lg">
              <Plus className="h-4 w-4" />
              Create Your First Character
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Create New Character Card */}
            <Card 
              className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={handleNewCharacter}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 h-48">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-3 mb-3 group-hover:scale-110 transition-transform">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-center">Create New Character</h3>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Design a unique AI personality
                </p>
              </CardContent>
            </Card>

            {/* Character Cards */}
            {filteredCharacters.map((character) => (
              <Card 
                key={character.id} 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer group relative"
                onClick={() => handleCharacterClick(character)}
              >
                <CardContent className="p-4">
                  {/* Character Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditCharacter(character);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => e.stopPropagation()}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Character Avatar */}
                  <div className="flex justify-center mb-3">
                    <Avatar className="h-16 w-16 border-2 border-border">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-lg font-semibold">
                        {character.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Character Info */}
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg truncate">{character.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {character.profession}
                    </Badge>
                    
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatLastUsed(character.lastUsed)}
                    </div>

                    {character.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {character.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Character Form Modal */}
      {showCharacterForm && (
        <CharacterForm
          character={editingCharacter}
          onClose={() => {
            setShowCharacterForm(false);
            setEditingCharacter(null);
          }}
        />
      )}
    </div>
  );
}