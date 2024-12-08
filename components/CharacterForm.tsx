'use client';
import { useState, useEffect } from 'react';
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
import { CharacterData } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CharacterFormProps {
  onCharacterSubmit: (data: CharacterData) => void;
}

function CharacterForm({ onCharacterSubmit }: CharacterFormProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(25);
  const [profession, setProfession] = useState('');
  const [tone, setTone] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedCharacterData = localStorage.getItem('characterData');
    if (storedCharacterData) {
      const data = JSON.parse(storedCharacterData);
      setName(data.name);
      setAge(data.age);
      setProfession(data.profession);
      setTone(data.tone);
      setDescription(data.description);
    }
  }, []);

  const handleSubmit = () => {
    const characterData: CharacterData = { name, age, profession, tone, description };
    if (!characterData.name || !characterData.profession || !characterData.tone) {
      setError("Please fill in all required fields (Name, Profession, Tone).");
      return;
    }
    setError(null);
    localStorage.setItem('characterData', JSON.stringify(characterData));
    onCharacterSubmit(characterData);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Define Your Character</CardTitle>
        <CardDescription>
          Fill in the details to bring your character to life.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
              <Input id="name" placeholder="e.g., John Doe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
              <Input id="age" type="number" placeholder="e.g., 30" value={age} onChange={(e) => setAge(parseInt(e.target.value, 10) || 25)} />
            </div>
          </div>
          <div>
            <label htmlFor="profession" className="block text-sm font-medium text-gray-700">Profession <span className="text-red-500">*</span></label>
            <Input id="profession" placeholder="e.g., Software Engineer" value={profession} onChange={(e) => setProfession(e.target.value)} />
          </div>
          <div>
            <label htmlFor="tone" className="block text-sm font-medium text-gray-700">Tone <span className="text-red-500">*</span></label>
            <Select onValueChange={setTone} value={tone}>
              <SelectTrigger id="tone">
                <SelectValue placeholder="Select a Tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="humorous">Humorous</SelectItem>
                <SelectItem value="serious">Serious</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <Textarea id="description" placeholder="e.g., A software engineer with a passion for AI..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} className="w-full">Create/Update Character</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default CharacterForm;