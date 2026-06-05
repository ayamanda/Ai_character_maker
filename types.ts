// types.ts

// ─── Character & Chat Core ────────────────────────────────────────────────────

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
  // Tool call metadata embedded in message (Phase 2)
  toolCalls?: ToolCallRecord[];
  // Memory extraction flag (Phase 4)
  memoryExtracted?: boolean;
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
  // Observability
  totalTokens?: number;
  cacheHitTokens?: number;
}

// ─── Stream State Machine (Phase 1) ──────────────────────────────────────────

/**
 * Explicit states for the AI response lifecycle.
 * - idle: no active stream
 * - thinking: request sent, awaiting first token
 * - tool-running: model issued a function call, executing tool
 * - responding: streaming text tokens to UI
 * - done: stream completed successfully
 * - error: stream failed (network / safety / API)
 * - cancelled: user aborted the stream
 */
export type StreamState =
  | 'idle'
  | 'thinking'
  | 'tool-running'
  | 'responding'
  | 'done'
  | 'error'
  | 'cancelled';

// ─── SSE Event Envelope (Phase 1+2) ──────────────────────────────────────────

/** Status event: stream lifecycle transitions */
export interface SSEStatusEvent {
  type: 'status';
  state: StreamState;
}

/** Content delta: a chunk of text to append */
export interface SSEContentEvent {
  type: 'content';
  delta: string;
}

/** Tool event: model wants to call a tool */
export interface SSEToolCallEvent {
  type: 'tool_call';
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

/** Tool result: server executed the tool, sending result back */
export interface SSEToolResultEvent {
  type: 'tool_result';
  callId: string;
  name: string;
  result: unknown;
  durationMs: number;
}

/** Error event from server */
export interface SSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

/** Metadata at end of stream (token usage, cache stats) */
export interface SSEMetaEvent {
  type: 'meta';
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  durationMs: number;
}

export type SSEEvent =
  | SSEStatusEvent
  | SSEContentEvent
  | SSEToolCallEvent
  | SSEToolResultEvent
  | SSEErrorEvent
  | SSEMetaEvent;

// ─── Tool Calling (Phase 2) ───────────────────────────────────────────────────

export interface ToolCallRecord {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  status: 'pending' | 'success' | 'error';
  startedAt: number;
}

export interface ChatAPIRequest {
  userMessage: string;
  characterData: CharacterData;
  messages: Message[];
  /** Enable tool calling for this turn */
  enableTools?: boolean;
  /** Turn ID for grouping tool calls in the UI */
  turnId?: string;
}

// ─── Live Mode (Phase 3) ─────────────────────────────────────────────────────

export type LiveModeState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'model-speaking'
  | 'interrupted'
  | 'error'
  | 'disconnected';

export interface LiveTokenResponse {
  token: string;
  expiresAt: string;
}

// ─── Memory (Phase 4) ────────────────────────────────────────────────────────

export type MemoryCategory = 'preference' | 'personal_info' | 'topic' | 'emotion';

export interface MemoryFact {
  fact: string;
  confidence: number;       // 0–1
  category: MemoryCategory;
  createdAt?: any;
  sessionId?: string;
}

export interface CharacterInsight {
  characterId: string;
  insight: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  createdAt?: any;
}

export interface MemoryExtractionResult {
  sessionFacts: MemoryFact[];
  characterInsights: CharacterInsight[];
  shouldUpdatePreferences: boolean;
}

// ─── Observability (Phase 5) ─────────────────────────────────────────────────

export interface TurnMetrics {
  turnId: string;
  sessionId: string;
  characterId: string;
  firstTokenMs: number;
  totalMs: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  toolCallCount: number;
  toolSuccessCount: number;
  wasInterrupted: boolean;
  streamState: StreamState;
  createdAt?: any;
}

// ─── Admin Types (existing) ───────────────────────────────────────────────────

export interface CustomClaims {
  admin: boolean;
  adminLevel: 'super' | 'moderator' | 'support';
  blocked: boolean;
  blockExpiry?: number;
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
  needsMetadataUpdate?: boolean;
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