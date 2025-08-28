# Project Structure

## Root Directory
```
├── app/                    # Next.js App Router pages
├── components/             # Reusable React components
├── lib/                    # Utility functions and configurations
├── public/                 # Static assets
├── types.ts               # Global TypeScript type definitions
└── [config files]         # Various configuration files
```

## App Directory (Next.js App Router)
```
app/
├── (auth)/                # Route group for authentication
│   ├── signin/           # Sign-in page
│   └── signup/           # Sign-up page
├── (chat)/               # Route group for chat functionality
│   ├── chat/            # Main chat interface
│   └── layout.tsx       # Chat-specific layout
├── api/                 # API routes
│   └── chat/           # Chat API endpoint
├── fonts/              # Custom font files
├── globals.css         # Global styles
├── layout.tsx          # Root layout
└── page.tsx            # Home page
```

## Components Directory
```
components/
├── auth/               # Authentication-related components
├── chat/               # Chat-specific components
├── ui/                 # shadcn/ui components
├── CharacterForm.tsx   # Character creation/editing
├── IntroductionDialog.tsx
└── SignOutButton.tsx
```

## Key Files & Conventions

### Type Definitions (`types.ts`)
- `CharacterData` - Character configuration interface
- `Message` - Chat message interface
- Keep all shared types in root-level types.ts

### Component Organization
- **UI Components**: Use shadcn/ui in `components/ui/`
- **Feature Components**: Group by feature (auth, chat)
- **Shared Components**: Place in root of components directory

### Styling Conventions
- Use Tailwind CSS classes with `cn()` utility for conditional styling
- Follow shadcn/ui patterns for component variants
- Responsive design with mobile-first approach
- Use CSS variables for theming

### File Naming
- **Components**: PascalCase (e.g., `CharacterForm.tsx`)
- **Pages**: lowercase (e.g., `page.tsx`)
- **API Routes**: lowercase (e.g., `route.ts`)
- **Utilities**: camelCase (e.g., `utils.ts`)

### Import Conventions
- Use `@/` alias for absolute imports from project root
- Group imports: external libraries, then internal modules
- Use named exports for components and utilities

### State Management
- Local state with React hooks (useState, useEffect)
- Firebase hooks for authentication (`useAuthState`)
- Firestore real-time listeners for data sync
- localStorage for client-side persistence