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
import { useRouter } from 'next/navigation';
import { CharacterData } from '@/types';


function CharacterForm() {
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(25);
  const [profession, setProfession] = useState('');
  const [tone, setTone] = useState('');
  const [description, setDescription] = useState('');
  const router = useRouter();
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
    router.push('/chat');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Define Your Character</CardTitle>
        <CardDescription>Fill in the details to bring your character to life.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" placeholder="Age" value={age} onChange={(e) => setAge(parseInt(e.target.value, 10) || 25)} />
          <Input placeholder="Profession" value={profession} onChange={(e) => setProfession(e.target.value)} />
          <Select onValueChange={setTone}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Tone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="humorous">Humorous</SelectItem>
              <SelectItem value="serious">Serious</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button onClick={handleSubmit}>Create/Update Character</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default CharacterForm;