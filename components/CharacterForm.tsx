'use client';
import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CharacterData } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  User, 
  Calendar, 
  Briefcase, 
  MessageCircle, 
  FileText,
  Sparkles,
  Bot,
  X
} from 'lucide-react';

interface CharacterFormProps {
  character?: CharacterData | null;
  onClose: () => void;
}

function CharacterForm({ character, onClose }: CharacterFormProps) {
  const [user] = useAuthState(auth);
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(25);
  const [profession, setProfession] = useState('');
  const [tone, setTone] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (character) {
      setName(character.name);
      setAge(character.age);
      setProfession(character.profession);
      setTone(character.tone);
      setDescription(character.description);
    } else {
      // Reset form for new character
      setName('');
      setAge(25);
      setProfession('');
      setTone('');
      setDescription('');
    }
  }, [character]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!user) return;
    
    if (!name || !profession || !tone) {
      setError("Please fill in all required fields (Name, Profession, Tone).");
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      const characterData: CharacterData = { 
        name, 
        age, 
        profession, 
        tone, 
        description,
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp()
      };

      if (character?.id) {
        // Update existing character
        const characterRef = doc(db, `users/${user.uid}/characters`, character.id);
        await updateDoc(characterRef, {
          ...characterData,
          createdAt: character.createdAt // Keep original creation date
        });
      } else {
        // Create new character
        const charactersRef = collection(db, `users/${user.uid}/characters`);
        await addDoc(charactersRef, characterData);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving character:', error);
      setError('Failed to save character. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toneOptions = [
    { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
    { value: 'formal', label: 'Formal', description: 'Professional and structured' },
    { value: 'humorous', label: 'Humorous', description: 'Witty and entertaining' },
    { value: 'serious', label: 'Serious', description: 'Focused and thoughtful' },
    { value: 'casual', label: 'Casual', description: 'Relaxed and informal' },
    { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic and passionate' },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <Card className="border-border shadow-lg backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-6 px-4 sm:px-6 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-3 sm:p-4 w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 shadow-lg">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {character ? 'Edit Your Character' : 'Create Your AI Character'}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Design a unique personality that will bring your conversations to life
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 px-4 sm:px-6">
          {error && (
            <Alert variant="destructive" className="border-destructive/50 animate-in slide-in-from-top-2 duration-300">
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-purple-500" />
                Character Name <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="name" 
                placeholder="e.g., Alex Thompson" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="border-border focus:border-purple-500 transition-all duration-200 focus:shadow-sm h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age" className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-blue-500" />
                Age
              </Label>
              <Input 
                id="age" 
                type="number" 
                placeholder="e.g., 28" 
                value={age.toString()} 
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setAge(1);
                  } else {
                    const numValue = parseInt(value, 10);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
                      setAge(numValue);
                    }
                  }
                }}
                className="border-border focus:border-blue-500 transition-all duration-200 focus:shadow-sm h-11"
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profession" className="flex items-center gap-2 text-sm font-medium">
              <Briefcase className="h-4 w-4 text-green-500" />
              Profession <span className="text-destructive">*</span>
            </Label>
            <Input 
              id="profession" 
              placeholder="e.g., Software Engineer, Teacher, Artist" 
              value={profession} 
              onChange={(e) => setProfession(e.target.value)}
              className="border-border focus:border-green-500 transition-all duration-200 focus:shadow-sm h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone" className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-orange-500" />
              Personality Tone <span className="text-destructive">*</span>
            </Label>
            <Select onValueChange={setTone} value={tone}>
              <SelectTrigger id="tone" className="border-border focus:border-orange-500 transition-all duration-200 focus:shadow-sm h-11">
                <SelectValue placeholder="Choose how your character communicates" />
              </SelectTrigger>
              <SelectContent>
                {toneOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-pink-500" />
              Character Background <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea 
              id="description" 
              placeholder="Describe your character's background, interests, or unique traits that will make conversations more engaging..."
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              className="border-border focus:border-pink-500 transition-all duration-200 focus:shadow-sm min-h-[100px] sm:min-h-[120px] resize-none"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {description.length}/500 characters
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 h-12"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="flex-1 h-12 text-base font-medium gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="text-white" />
                  {character ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {character ? 'Update' : 'Create'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export default CharacterForm;