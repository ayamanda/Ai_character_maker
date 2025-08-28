# Design Document

## Overview

This design enhances the AI Character Chat application with two major improvements:

1. **Enhanced Text Formatting**: Replace the current basic text formatting in `MessageContent.tsx` with a comprehensive markdown renderer that supports bold, italic, code blocks, headers, lists, and blockquotes.

2. **Admin Interface**: Create a complete admin dashboard with role-based access control using Firebase custom claims, allowing administrators to manage users, characters, chats, and system analytics.

## Architecture

### Text Formatting Architecture

The current `MessageContent` component has basic bold text support but needs a complete overhaul to support full markdown rendering.

**Current State:**
- Simple string replacement for `**bold**` text
- No support for other markdown features
- Basic console logging for debugging

**New Architecture:**
- Replace custom formatting logic with a proven markdown library
- Use `react-markdown` with `remark-gfm` for GitHub Flavored Markdown support
- Add syntax highlighting for code blocks using `react-syntax-highlighter`
- Implement custom renderers for consistent styling with the app's design system

### Admin Interface Architecture

**Authentication & Authorization:**
- Extend Firebase Auth with custom claims for admin roles
- Create middleware to protect admin routes
- Implement role-based access control (RBAC) with multiple admin levels

**Data Access Patterns:**
- Admin-specific Firestore security rules
- Aggregated data queries for analytics
- Batch operations for bulk user management
- Real-time listeners for live admin dashboard updates

**Route Structure:**
```
/admin
├── /dashboard          # Overview & analytics
├── /users             # User management
├── /characters        # Character oversight
├── /chats             # Chat monitoring
└── /settings          # Admin configuration
```

## Components and Interfaces

### Enhanced MessageContent Component

```typescript
interface MessageContentProps {
  content: string;
  isUser: boolean;
}

interface MarkdownComponents {
  // Custom renderers for consistent styling
  h1: ({ children }: any) => JSX.Element;
  h2: ({ children }: any) => JSX.Element;
  h3: ({ children }: any) => JSX.Element;
  code: ({ inline, className, children }: any) => JSX.Element;
  pre: ({ children }: any) => JSX.Element;
  blockquote: ({ children }: any) => JSX.Element;
  ul: ({ children }: any) => JSX.Element;
  ol: ({ children }: any) => JSX.Element;
  li: ({ children }: any) => JSX.Element;
  strong: ({ children }: any) => JSX.Element;
  em: ({ children }: any) => JSX.Element;
}
```

### Admin Interface Components

**AdminLayout Component:**
```typescript
interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
}
```

**UserManagement Components:**
```typescript
interface UserListProps {
  users: AdminUser[];
  onUserSelect: (userId: string) => void;
  onUserAction: (userId: string, action: UserAction) => void;
}

interface UserDetailsProps {
  user: AdminUser;
  characters: CharacterData[];
  chatSessions: ChatSession[];
  onUpdateUser: (updates: Partial<AdminUser>) => void;
}

interface UserAction {
  type: 'block' | 'unblock' | 'delete' | 'makeAdmin' | 'removeAdmin';
  reason?: string;
  duration?: number; // for temporary blocks
}
```

**Character Management Components:**
```typescript
interface CharacterOversightProps {
  characters: AdminCharacterView[];
  onCharacterAction: (characterId: string, action: CharacterAction) => void;
}

interface CharacterAction {
  type: 'delete' | 'flag' | 'unflag';
  reason: string;
}
```

**Chat Monitoring Components:**
```typescript
interface ChatMonitorProps {
  chats: AdminChatView[];
  onChatSelect: (chatId: string) => void;
  filters: ChatFilters;
}

interface ChatFilters {
  userId?: string;
  characterId?: string;
  dateRange?: { start: Date; end: Date };
  flagged?: boolean;
}
```

### New Data Models

**Admin User Model:**
```typescript
interface AdminUser extends User {
  isAdmin: boolean;
  adminLevel: 'super' | 'moderator' | 'support';
  isBlocked: boolean;
  blockReason?: string;
  blockExpiry?: Date;
  lastLogin: Date;
  registrationDate: Date;
  characterCount: number;
  messageCount: number;
  flaggedContent: number;
}
```

**Admin Character View:**
```typescript
interface AdminCharacterView extends CharacterData {
  userId: string;
  userName: string;
  userEmail: string;
  messageCount: number;
  lastUsed: Date;
  isFlagged: boolean;
  flagReason?: string;
  reportCount: number;
}
```

**Admin Chat View:**
```typescript
interface AdminChatView extends ChatSession {
  userId: string;
  userName: string;
  userEmail: string;
  isFlagged: boolean;
  flagReason?: string;
  lastActivity: Date;
  totalMessages: number;
}
```

**System Analytics:**
```typescript
interface SystemAnalytics {
  totalUsers: number;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  totalCharacters: number;
  totalMessages: number;
  popularCharacters: Array<{
    characterId: string;
    name: string;
    messageCount: number;
    userCount: number;
  }>;
  usagePatterns: {
    peakHours: number[];
    dailyActivity: Array<{
      date: string;
      users: number;
      messages: number;
    }>;
  };
  flaggedContent: {
    characters: number;
    chats: number;
    users: number;
  };
}
```

## Data Models

### Firebase Custom Claims Structure

```typescript
interface CustomClaims {
  admin: boolean;
  adminLevel: 'super' | 'moderator' | 'support';
  blocked: boolean;
  blockExpiry?: number; // timestamp
}
```

### Firestore Collections for Admin

**Admin Users Collection (`/adminUsers/{userId}`):**
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  adminLevel: 'super' | 'moderator' | 'support';
  isBlocked: boolean;
  blockReason?: string;
  blockExpiry?: Timestamp;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  metadata: {
    characterCount: number;
    messageCount: number;
    flaggedContent: number;
  };
}
```

**Admin Actions Log (`/adminActions/{actionId}`):**
```typescript
{
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: 'user' | 'character' | 'chat';
  targetId: string;
  reason: string;
  timestamp: Timestamp;
  details: Record<string, any>;
}
```

**System Analytics (`/analytics/daily/{date}`):**
```typescript
{
  date: string;
  activeUsers: number;
  newUsers: number;
  totalMessages: number;
  newCharacters: number;
  flaggedContent: number;
  peakConcurrentUsers: number;
  averageSessionDuration: number;
}
```

## Error Handling

### Text Formatting Error Handling

1. **Markdown Parsing Errors:**
   - Graceful fallback to plain text rendering
   - Error boundary component to catch rendering issues
   - Sanitization of user input to prevent XSS

2. **Performance Considerations:**
   - Memoization of markdown rendering for repeated content
   - Lazy loading of syntax highlighter languages
   - Debounced rendering for streaming content

### Admin Interface Error Handling

1. **Authentication Errors:**
   - Redirect to login on auth failure
   - Clear error messages for insufficient permissions
   - Automatic token refresh handling

2. **Data Loading Errors:**
   - Retry mechanisms for failed queries
   - Skeleton loading states
   - Error boundaries with user-friendly messages

3. **Action Errors:**
   - Confirmation dialogs for destructive actions
   - Rollback mechanisms for failed operations
   - Detailed error logging for debugging

## Testing Strategy

### Text Formatting Testing

1. **Unit Tests:**
   - Test markdown rendering for all supported syntax
   - Test custom component renderers
   - Test error handling and fallbacks
   - Test performance with large content

2. **Integration Tests:**
   - Test formatting in chat context
   - Test streaming content formatting
   - Test responsive design across devices

### Admin Interface Testing

1. **Authentication Testing:**
   - Test role-based access control
   - Test custom claims verification
   - Test session management

2. **Functionality Testing:**
   - Test user management operations
   - Test character and chat oversight
   - Test analytics data accuracy
   - Test bulk operations

3. **Security Testing:**
   - Test admin route protection
   - Test data access permissions
   - Test input sanitization
   - Test audit logging

### End-to-End Testing

1. **User Flow Testing:**
   - Test complete admin workflows
   - Test formatting in real chat scenarios
   - Test responsive behavior

2. **Performance Testing:**
   - Test admin dashboard with large datasets
   - Test markdown rendering performance
   - Test real-time updates

## Security Considerations

### Admin Access Security

1. **Authentication:**
   - Multi-factor authentication for admin accounts
   - Regular token rotation
   - Session timeout policies

2. **Authorization:**
   - Principle of least privilege
   - Role-based permissions
   - Audit logging for all admin actions

3. **Data Protection:**
   - Encrypted sensitive data
   - Secure admin-to-admin communication
   - Regular security audits

### Content Security

1. **Markdown Sanitization:**
   - XSS prevention in rendered content
   - HTML sanitization
   - Safe link handling

2. **Input Validation:**
   - Server-side validation for all admin actions
   - Rate limiting for admin operations
   - Input sanitization for search queries

## Implementation Phases

### Phase 1: Enhanced Text Formatting
- Replace MessageContent component with markdown renderer
- Add syntax highlighting for code blocks
- Implement custom styling for markdown elements
- Add comprehensive testing

### Phase 2: Admin Authentication & Authorization
- Implement Firebase custom claims
- Create admin route protection
- Build basic admin layout and navigation
- Add role-based access control

### Phase 3: User Management
- Build user listing and search
- Implement user details view
- Add user action capabilities (block, delete, etc.)
- Create user analytics

### Phase 4: Content Management
- Build character oversight interface
- Implement chat monitoring
- Add content flagging system
- Create bulk management tools

### Phase 5: Analytics & Reporting
- Implement system analytics collection
- Build admin dashboard with metrics
- Add reporting capabilities
- Create usage pattern analysis

### Phase 6: Advanced Features
- Add automated content moderation
- Implement notification system for admins
- Create advanced search and filtering
- Add export capabilities for data