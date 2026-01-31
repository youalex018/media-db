## Environment Separation (dev/demo/prod)

This project expects separate Supabase projects for each environment.
Do **not** reuse the same Supabase project across dev/prod.

### Templates

Copy the templates below into your real environment files.
We do not commit `.env` or `.env.local` files to the repo.

#### Backend (FastAPI)

- `backend/env.development.template`
- `backend/env.production.template`

Copy the appropriate template to `backend/.env` when running locally, or
set the values in your hosting provider.

#### Frontend (Vite)

- `frontend/env.development.template`
- `frontend/env.production.template`

Copy the appropriate template to:
- `frontend/.env.local` for local development
- environment variables in your hosting provider for demo/prod

### Supabase Migrations

Apply migrations per project:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Repeat for dev and prod projects.

### C++ Ratings Stats Tool

Build the CLI used by the backend endpoint `/api/ratings/stats`:

```bash
cd tools/cpp
cmake -S . -B build
cmake --build build --config Release
```

The backend looks for the binary at `tools/cpp/build/ratings_stats`
(`ratings_stats.exe` on Windows). Override with:

- `RATINGS_STATS_BIN` (absolute path to the binary)
