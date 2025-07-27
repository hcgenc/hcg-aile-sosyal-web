# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turkish map-based address and category management system built with Next.js 15, React 19, TypeScript, and Supabase. The application provides a geospatial interface for managing addresses with categorization using Yandex Maps integration.

## Development Commands

- **Development server**: `npm run dev` (Next.js development server)
- **Build**: `npm run build` (Production build)
- **Start production**: `npm start` (Start production server)
- **Lint**: `npm run lint` (ESLint check)
- **Type check**: Run TypeScript compiler manually with `npx tsc --noEmit`

## Architecture Overview

### Core Technologies
- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **Styling**: Tailwind CSS with custom theme configuration
- **Database**: Supabase (PostgreSQL) with custom proxy layer
- **Maps**: Yandex Maps API integration
- **Authentication**: Custom JWT-based auth system
- **UI Components**: shadcn/ui component library with Radix UI primitives

### Project Structure
- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable UI components including shadcn/ui components
- `context/` - React Context providers for global state management
- `lib/` - Utility functions, auth logic, database proxy, and security helpers
- `types/` - TypeScript type definitions
- `hooks/` - Custom React hooks

### Key Architectural Patterns

#### Database Access Pattern
The application uses a custom Supabase proxy layer (`lib/supabase-proxy.ts`) instead of direct Supabase client calls. This provides:
- Centralized authentication handling
- Request/response normalization
- Error handling consistency
- Security layer abstraction

Always use the `supabaseProxy` instance from `lib/supabase-proxy.ts` for database operations.

#### Context-Based State Management
Four main context providers wrap the application:
- `SupabaseProvider` - Database connection management
- `AuthProvider` - User authentication state
- `ConnectionProvider` - Network connection status
- `MapProvider` - Map-related state management

#### Authentication System
- Custom JWT implementation using `jose` library
- Token-based authentication with localStorage persistence
- Protected routes via `AuthGuard` component
- Admin functionality with password verification

### Database Schema
The database consists of three main tables:
- `main_categories` - Primary categorization system
- `sub_categories` - Secondary categorization linked to main categories
- `addresses` - Location data with coordinates and category associations

Schema details are available in `database-schema.sql`.

### Security Considerations
- Content Security Policy configured in `next.config.mjs`
- CORS headers properly configured for API routes
- Input sanitization and validation throughout
- Security middleware for app control and authentication
- Comprehensive security headers implementation

### Map Integration
Yandex Maps integration requires:
- Custom CSS (`app/yandex-maps.css`) for map styling
- TypeScript definitions for Yandex Maps API (`lib/yandex-maps.ts`)
- Map context provider for state management

## Configuration Notes

### Environment Variables
The application expects standard Next.js environment variables plus:
- JWT_SECRET for authentication
- Supabase configuration (handled via proxy)

### Build Configuration
- TypeScript and ESLint errors are ignored during builds (configured in `next.config.mjs`)
- Images are unoptimized for deployment flexibility
- Custom webpack alias configuration for @ imports

### Deployment
Configured for Vercel deployment with:
- Custom build command installing TypeScript
- Framework detection set to Next.js
- Region preference: fra1

## Common Development Patterns

When working with this codebase:

1. **Database Operations**: Always use `supabaseProxy` from `lib/supabase-proxy.ts`
2. **Authentication**: Check auth state via `useAuth` hook from `context/auth-context.tsx`
3. **UI Components**: Use existing shadcn/ui components from `components/ui/`
4. **Styling**: Follow Tailwind CSS patterns with dark theme default
5. **Type Safety**: Leverage TypeScript definitions in `types/` directory
6. **Map Features**: Use `MapProvider` context for map-related functionality

## API Routes Structure

API routes follow RESTful patterns:
- `/api/auth/login` - Authentication endpoint
- `/api/users` - User management
- `/api/admin/*` - Administrative functions
- `/api/supabase` - Database proxy endpoint
- `/api/health` - Health check endpoint
- `/api/app-control` - Application control system