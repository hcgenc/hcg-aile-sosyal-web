# Turkish Map Application

A Turkish web application for map-based address and category management with **SERVER-SIDE PROXY** architecture for maximum security.

## 🔒 Security Architecture

This application uses a **server-side proxy** pattern where:
- ✅ **Zero client exposure** - No Supabase credentials on client-side
- ✅ **Server-only secrets** - All sensitive data stays on server
- ✅ **API proxy layer** - All database requests go through `/api/supabase`
- ✅ **Service role security** - Uses Supabase service role key server-side

## Environment Setup

### 1. Local Development

Create a `.env.local` file in the root directory:

```env
# SERVER-SIDE ONLY (NO NEXT_PUBLIC_ prefix!)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
```

**🚨 Important Security Notes:**
- **NO `NEXT_PUBLIC_` prefix** - these are server-side only
- Client-side never sees Supabase credentials
- All requests go through `/api/supabase` proxy
- `.env.local` is in `.gitignore` for security

### 2. Vercel Deployment

In your Vercel dashboard, add these environment variables:

| Name | Value | Notes |
|------|-------|-------|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | Server-side only |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role key) | **Most important** |
| `SUPABASE_ANON_KEY` | `eyJ...` (anon key) | For additional features |

### 3. Finding Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the following:
   - **Project URL** → Use as `SUPABASE_URL`
   - **service_role secret** → Use as `SUPABASE_SERVICE_ROLE_KEY` ⚠️
   - **anon public** → Use as `SUPABASE_ANON_KEY`

**⚠️ Service Role Key Warning:**
The service role key has admin access to your database. Keep it absolutely secure!

## 🛡️ Security Features

✅ **Maximum Security Implementation:**
- **Server-side proxy**: All DB requests through `/api/supabase` 
- **Zero client exposure**: No credentials in browser/bundle
- **Service role security**: Admin-level server-side access
- **No NEXT_PUBLIC_ variables**: Everything server-side
- **Request validation**: All requests validated server-side
- **Error handling**: Secure error messages
- **TypeScript safety**: Fully typed proxy client

## 🏗️ Architecture

```
Browser Client
     ↓ (HTTP requests)
Next.js API Routes (/api/supabase)
     ↓ (Service Role Key)
Supabase Database
```

**Previous architecture** (less secure):
```
Browser Client → Supabase (with anon key in bundle)
```

**New architecture** (maximum security):
```
Browser Client → Next.js Server → Supabase (with service key)
```

## Database Setup

Make sure you have created the required tables in your Supabase database:

- `main_categories`
- `sub_categories` 
- `addresses`
- `users`
- `logs`
- `api_keys`

## Features

- 🗺️ Interactive map with Yandex Maps integration
- 📍 Address management with geocoding
- 🏷️ Category and subcategory management
- 👥 User authentication and role-based access
- 📊 Bulk data import via Excel
- 🔍 Advanced filtering and search
- 📱 Responsive design with dark theme
- 📝 Activity logging

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Maps**: Yandex Maps API
- **Authentication**: Custom auth with Supabase
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see above)
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Deployment

This app is optimized for Vercel deployment:

### Quick Deployment Steps:

1. **Connect Repository to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Environment Variables:**
   - In Vercel project settings, go to "Environment Variables"
   - Add the following variables for all environments (Production, Preview, Development):
   
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your_actual_anon_key_here
   ```

3. **Deploy:**
   - Vercel will automatically deploy on push to main branch
   - First deployment will start immediately after setup

### Alternative: Deploy with Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

## Security Notes

- Never commit `.env.local` or `.env` files to version control
- Use environment variables for all sensitive data
- The `NEXT_PUBLIC_` prefix makes variables available to the browser
- Keep your Supabase service role key secure (not used in this frontend app)
- Environment variables are managed directly in Vercel dashboard
