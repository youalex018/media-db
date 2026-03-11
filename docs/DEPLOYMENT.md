# Shelflife Deployment Guide

This guide covers deploying Shelflife (media-db) to production: **Vercel** (frontend), **Render** (backend), and **Supabase** (database + auth).

---

## Table of Contents

1. [Supabase Production Setup](#2-supabase-production-setup)
2. [Render Backend Setup](#3-render-backend-setup)
3. [Vercel Frontend Setup](#4-vercel-frontend-setup)
4. [Environment Variables Reference](#5-environment-variables-reference)
5. [Post-Deployment Checklist](#6-post-deployment-checklist)

---

## 1. Supabase Production Setup

### Step 1: Create the production project

1. Go to [Supabase Dashboard](https://app.supabase.com).
2. Click **New Project**.
3. Choose your organization.
4. **Name:** `media-db-prod` (or `shelflife-prod`).
5. **Database Password:** Generate and store securely (e.g. password manager).
6. **Region:** Closest to your users.
7. Click **Create new project**.

### Step 2: Get project credentials

1. In the project, go to **Settings → API**.
2. Copy:
   - **Project URL** (e.g. `https://xxxxxxxx.supabase.co`)
   - **anon public** key → for frontend and backend
   - **service_role** key → **backend only, never expose to client**
3. Go to **Settings → API → JWT Settings** and copy **JWT Secret** (optional but recommended for backend verification).

### Step 3: Apply migrations

From your project root:

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Log in (browser opens)
supabase login

# Link to production project (get project ref from Dashboard → Settings → General)
supabase link --project-ref YOUR_PROD_PROJECT_REF

# Push all migrations
supabase db push
```

**Alternative (manual):** Run each SQL file in `supabase/migrations/` in order via **Supabase Dashboard → SQL Editor**.

### Step 4: Configure Auth redirect URLs

1. Go to **Authentication → URL Configuration**.
2. Under **Redirect URLs**, add:
   - `https://shelflife-db.vercel.app/**`
   - `https://shelflife-db.vercel.app` (for magic links)
3. Under **Site URL**, set: `https://shelflife-db.vercel.app`

---

## 2. Render Backend Setup

### Step 1: Create a Web Service

1. Go to [Render Dashboard](https://dashboard.render.com).
2. **New + → Web Service**.
3. Connect your GitHub account and select the **media-db** (or shelflife) repository.

### Step 2: Configure the service

| Setting | Value |
|---------|-------|
| **Name** | `shelflife-api` (or your choice) |
| **Region** | Same as Supabase for lower latency |
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

### Step 3: Environment variables

Add these in **Environment** (Render uses `$PORT` automatically):

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://YOUR_PROD_REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your prod service role key |
| `SUPABASE_ANON_KEY` | Your prod anon key |
| `SUPABASE_JWT_SECRET` | (Optional) JWT secret from Supabase |
| `TMDB_API_KEY` | Your TMDb API key |
| `GEMINI_API_KEY` | (Optional) For AI insights |
| `FLASK_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://shelflife-db.vercel.app` |

**Important:** `ALLOWED_ORIGINS` must include your Vercel URL. Separate multiple origins with commas (no spaces).

### Step 4: Deploy

1. Click **Create Web Service**.
2. Wait for the first deploy to finish.
3. Copy the service URL (e.g. `https://shelflife-api.onrender.com`). You'll use this for `VITE_API_BASE_URL` in Vercel.

### Free tier notes

- Free instances **spin down after 15 minutes** of inactivity.
- First request after spin-down may take **30–60 seconds** (cold start).
- Consider Render paid tier ($7/mo) or [Railway](https://railway.app) for always-on if cold starts are an issue.

---

## 3. Vercel Frontend Setup

### Step 1: Import project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard).
2. **Add New → Project**.
3. Import from GitHub: select **media-db** (or shelflife).
4. If you have multiple projects, ensure you're importing the correct one.

### Step 2: Configure build settings

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default for Vite) |
| **Install Command** | `npm install` (default) |

### Step 3: Environment variables

Add these under **Settings → Environment Variables** (apply to **Production**):

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://YOUR_PROD_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your prod anon key |
| `VITE_API_BASE_URL` | Your Render backend URL (e.g. `https://shelflife-api.onrender.com`) |

**Important:** `VITE_API_BASE_URL` must be the full backend URL (no trailing slash). The frontend uses this to call the API in production since there's no Vite proxy.

### Step 4: Deploy

1. Click **Deploy**.
2. After deployment, your app will be at `https://shelflife-db.vercel.app` (or your configured domain).

### Automatic deploys

- Every push to `main` triggers a new Vercel deployment.
- Every push to `main` (if Render is connected to the same repo) triggers a backend redeploy.

---

## 4. Environment Variables Reference

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_API_BASE_URL` | Yes (prod) | Backend API base URL (e.g. `https://shelflife-api.onrender.com`) |

### Backend (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (never expose) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_JWT_SECRET` | Recommended | For JWT verification |
| `TMDB_API_KEY` | Yes | TMDb API key for search |
| `GEMINI_API_KEY` | No | For AI insights feature |
| `FLASK_ENV` | Yes | `production` |
| `ALLOWED_ORIGINS` | Yes | Comma-separated list of allowed frontend origins |

---

## 5. Post-Deployment Checklist

- [ ] **Supabase:** Migrations applied, redirect URLs configured.
- [ ] **Render:** Backend healthy, `/healthz` returns `{"status":"ok"}`.
- [ ] **Vercel:** Frontend loads, no console errors.
- [ ] **Auth:** Sign in with magic link works; redirect returns to production URL.
- [ ] **Search:** TMDb/Open Library search works (requires auth).
- [ ] **Library:** Add to library, update rating/status.
- [ ] **CORS:** No CORS errors when frontend calls backend. If you see them, add your Vercel URL to `ALLOWED_ORIGINS` and redeploy the backend.

### Common issues

| Issue | Fix |
|-------|-----|
| Search/add fails, "Failed to fetch" | Check `VITE_API_BASE_URL` is set and points to Render. Redeploy frontend. |
| CORS error | Add `https://shelflife-db.vercel.app` to `ALLOWED_ORIGINS` in Render, redeploy. |
| Auth redirect goes to localhost | Update Supabase Auth redirect URLs to production. |
| Backend 500 on startup | Check env vars; ensure `SUPABASE_*` and `TMDB_API_KEY` are set. |
| Cold start timeout | Free Render sleeps after 15 min. Wait or upgrade plan. |

---

## Deployment order

1. **Supabase** — Create project, run migrations, configure auth.
2. **Render** — Deploy backend, get URL.
3. **Vercel** — Deploy frontend with backend URL in `VITE_API_BASE_URL`.

If the backend isn't ready yet, the frontend will still deploy; API calls will fail until `VITE_API_BASE_URL` points to a live backend.
