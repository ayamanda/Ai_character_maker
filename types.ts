// types.ts (create a new file for types)
export interface CharacterData {
  id?: string;
  name: string;
  age: number;
  profession: string;
  tone: string;
  description: string;
  createdAt?: any;
  lastUsed?: any;
  avatar?: string;
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

export interface ChatSession {
  id: string;
  name: string;
  characterId: string;
  characterData: CharacterData;
  lastMessage: string;
  lastMessageTime: any;
  createdAt: any;
  messageCount: number;
}