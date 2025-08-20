# 📚 Media DB

A personal media database for tracking movies, TV shows, and books. Built with **Supabase** (auth + database), **Flask** (secure backend), and **React + TypeScript** (frontend).

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account

### 1. Clone and Setup
```bash
git clone <repo-url>
cd media-db
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

### 3. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase URL and service role key
python wsgi.py
```

### 4. Database Setup
```bash
# From project root
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## 🔧 Environment Variables

### Frontend (`.env.local`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (`.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FLASK_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

## 🛡️ Security

- **No secrets in git** - All sensitive keys are in gitignored `.env` files
- **Row Level Security** - Users can only see their own data
- **JWT Authentication** - Secure token-based auth with Supabase
- **Service Role Isolation** - Backend uses service role for catalog writes only

## 📡 API Endpoints

### Health
- `GET /healthz` - Health check

### Auth (Protected)
- `GET /api/me` - Get current user info

### Placeholder (501 responses)
- `GET /api/search?q=query` - Search external sources
- `POST /api/library/add` - Add item to library
- `GET /api/library` - Get user's library

## 🔍 Testing Auth

1. Start backend: `cd backend && python wsgi.py`
2. Start frontend: `cd frontend && npm run dev`
3. Visit `http://localhost:5173`
4. Use the auth test interface to sign in and test backend integration

## ⚠️ Important Notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- Never commit real environment files
- RLS is enabled on all tables - test with different users
- Frontend uses anon key only - backend uses service role