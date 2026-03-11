# Shelflife

A personal media shelf for tracking movies, TV shows, books, and more. Built with **Supabase** (auth + database), **FastAPI** (secure backend), and **React + TypeScript** (frontend).

## Features

- **Authentication**: Email magic link sign-in with Supabase
- **Token Security**: Token-based auth with key set validation and caching
- **Row Level Security**: Users can only access their own data
- **Catalog Management**: Shared works (movies/shows/books) database
- **User Library**: Personal tracking with status, ratings, and notes
- **REST API**: FastAPI backend with comprehensive error handling

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account ([create one free](https://supabase.com))

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/media-db.git
cd media-db
```

### 2. Database Setup

First, create your Supabase project and apply migrations:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project (find project-ref in Supabase Dashboard → Settings → General)
npx supabase link --project-ref your-project-ref

# Apply database migrations
npx supabase db push
```

**Manual setup:** If CLI doesn't work, copy and run migration files from `supabase/migrations/` in Supabase SQL Editor.

See [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md) for detailed instructions.

### 3. Frontend Setup
```bash
cd frontend
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Start dev server
npm run dev
```

**Frontend runs on:** http://localhost:3000

### 4. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows PowerShell):
.venv\Scripts\Activate.ps1

# Or (Windows CMD):
.venv\Scripts\activate.bat

# Or (Unix/Mac):
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env with your Supabase credentials:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# SUPABASE_ANON_KEY=your-anon-key
# FLASK_ENV=development
# ALLOWED_ORIGINS=http://localhost:3000

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

**Backend runs on:** http://localhost:5000

### 5. Verify Setup

1. Visit http://localhost:3000
2. You should see the Auth Test page
3. Enter your email and click "Send Magic Link"
4. Check your email and click the link
5. You should be redirected back, signed in
6. Click "Test Backend Auth" to verify backend integration

## Configuration

### Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` (frontend) and backend
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (backend only)

### Environment Files

#### Frontend `.env.local`
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Important:**
- Variables MUST start with `VITE_` prefix
- No quotes around values
- Restart dev server after changes (Ctrl+C, then `npm run dev`)

#### Backend `.env`
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
FLASK_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

**Important:**
- Service role key is PRIVATE - never commit or expose to client
- File encoding must be UTF-8 (no BOM)
- Activate virtual environment before running server

## Security

### Authentication Model
- **Frontend**: Uses Supabase anon key (safe for public exposure)
- **Backend**: Validates auth tokens via Supabase key set
- **Service Role**: Used only for privileged catalog operations (server-side)

### Row Level Security (RLS)
- **User Tables**: `user_items`, `profiles` - users can only CRUD their own data
- **Catalog Tables**: `works`, `people`, `genres` - public read, service role write only
- **RLS Enforced**: All user-scoped tables have policies requiring `user_id = auth.uid()`

### Key Management
```
┌─────────────┬────────────────────┬──────────────┐
│ Component   │ Keys Used          │ Exposure     │
├─────────────┼────────────────────┼──────────────┤
│ Frontend    │ Anon Key           │ Public (safe)│
│ Backend     │ Service Role Key   │ Private      │
│ Backend     │ Anon Key           │ Private      │
└─────────────┴────────────────────┴──────────────┘
```

**Never commit:**
- `.env` files
- Service role keys
- Real user data

See [`SECURITY.md`](SECURITY.md) for detailed security architecture.

## API Endpoints

### Public
- `GET /healthz` - Health check (returns `{"status": "ok"}`)

### Protected (Requires Auth Token)
- `GET /api/me` - Get current user info
  - Returns: `{"user_id": "uuid", "email": "user@example.com"}`
  - Errors: See [Authentication Error Codes](#authentication-error-codes)

### Coming Soon
- `GET /api/search?q=query` - Search TMDb + Open Library
- `POST /api/library/add` - Add media to library
- `GET /api/library` - Get user's library with filters
- `PATCH /api/library/:id` - Update rating/status/notes
- `DELETE /api/library/:id` - Remove from library

### Authentication Error Codes

| Error | Description |
|-------|-------------|
| `missing_authorization_header` | No Authorization header |
| `invalid_bearer_format` | Header not "Bearer <token>" |
| `empty_token` | Token is empty |
| `invalid_jwt_format` | Malformed token |
| `missing_key_id` | Token missing key ID |
| `key_not_found` | Unknown key ID |
| `invalid_issuer` | Wrong Supabase project |
| `token_expired` | Token expired |
| `signature_verification_failed` | Invalid signature |
| `jwks_unavailable` | Cannot fetch auth key set |

## Testing

### Quick Tests
```bash
# Backend tests (with test environment)
cd backend
python run_tests.py

# Auth tests (requires running server)
python test_auth.py

# RLS tests (requires real Supabase)
python test_rls.py
```

### Manual Testing
1. Start both servers (backend + frontend)
2. Visit http://localhost:3000
3. Test email magic link authentication
4. Click "Test Backend Auth" to verify integration

See [`docs/TESTING.md`](docs/TESTING.md) for comprehensive testing guide.

## Documentation

- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment (Vercel, Render, Supabase)
- **[TESTING.md](docs/TESTING.md)** - Complete testing guide
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[DATABASE_SETUP.md](docs/DATABASE_SETUP.md)** - Database setup guide  
- **[AUTH_TESTS.md](docs/AUTH_TESTS.md)** - Authentication testing details
- **[SECURITY.md](SECURITY.md)** - Security model and RLS policies

## Troubleshooting

### Frontend Issues
- **Blank auth page?** Check `.env.local` and restart Vite dev server
- **401 errors?** Verify you're signed in and backend/frontend use same Supabase project
- **Environment vars not loading?** Restart Vite (Ctrl+C, `npm run dev`)

### Backend Issues
- **Server won't start?** Check `.env` file, activate virtual environment
- **Auth key set errors?** Verify internet connectivity and Supabase URL
- **Import errors?** Run `pip install -r requirements.txt`

### Database Issues
- **Tables don't exist?** Run migrations: `npx supabase db push`
- **Profile creation fails?** Apply trigger migration or create profile manually
- **RLS errors?** Verify policies exist and are enabled

See [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) for detailed solutions.

## Contributing

This is a personal project, but suggestions and feedback are welcome! Please:

1. Check existing documentation first
2. Open an issue to discuss major changes
3. Follow existing code style and patterns
4. Add tests for new features
5. Update documentation as needed

## Important Reminders

- **Never commit** `.env` files or service role keys
- **Always use RLS** on tables with user data
- **Keep service role** server-side only
- **Test with multiple users** to verify RLS
- **Restart dev servers** after environment file changes
