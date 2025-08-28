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

// Admin-related types
export interface CustomClaims {
  admin: boolean;
  adminLevel: 'super' | 'moderator' | 'support';
  blocked: boolean;
  blockExpiry?: number; // timestamp
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  adminLevel: 'super' | 'moderator' | 'support';
  isBlocked: boolean;
  blockReason?: string;
  blockExpiry?: Date;
  createdAt: Date;
  lastLogin: Date;
  metadata: {
    characterCount: number;
    messageCount: number;
    flaggedContent: number;
  };
  needsMetadataUpdate?: boolean; // Internal flag for background updates
}

export interface AdminCharacterView extends CharacterData {
  userId: string;
  userName: string;
  userEmail: string;
  messageCount: number;
  lastUsed: Date;
  isFlagged: boolean;
  flagReason?: string;
  reportCount: number;
}

export interface AdminChatView extends ChatSession {
  userId: string;
  userName: string;
  userEmail: string;
  isFlagged: boolean;
  flagReason?: string;
  lastActivity: Date;
  totalMessages: number;
}