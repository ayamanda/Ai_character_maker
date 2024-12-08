// types.ts (create a new file for types)
export interface CharacterData {
  name: string;
  age: number;
  profession: string;
  tone: string;
  description: string;
}

export interface Message {
  id: string;
  text: string;
  createdAt: any;
  uid: string;
  photoURL: string | null;
  displayName: string | null;
  character: boolean;
}