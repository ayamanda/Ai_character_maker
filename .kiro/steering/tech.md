# Technology Stack

## Framework & Runtime
- **Next.js 15** with App Router (React 19)
- **TypeScript** for type safety
- **Node.js** runtime environment

## Styling & UI
- **Tailwind CSS** with custom design system
- **shadcn/ui** component library (New York style)
- **Radix UI** primitives for accessible components
- **Lucide React** for icons
- **CSS Variables** for theming with HSL color system

## Backend & Database
- **Firebase** for authentication and Firestore database
- **Google Gemini API** with Gemini 2.5 Flash model for AI responses
- **Next.js API Routes** for server-side logic

## Key Libraries
- `react-firebase-hooks` for Firebase integration
- `react-responsive` for responsive design detection
- `class-variance-authority` and `clsx` for conditional styling
- `tailwind-merge` for class merging utilities

## Development Tools
- **ESLint** for code linting (builds ignore errors)
- **PostCSS** for CSS processing
- **TypeScript** strict mode enabled

## Common Commands
```bash
# Development
npm run dev          # Start development server on localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Environment Variables Required
- `NEXT_PUBLIC_FIREBASE_*` - Firebase configuration
- `GEMINI_API_KEY` - Google Gemini API key for AI responses

## Architecture Notes
- Uses App Router with route groups for organization
- Client-side state management with React hooks
- Real-time data sync via Firestore listeners
- Responsive design with mobile-first approach