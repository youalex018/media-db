# Troubleshooting Guide

Common issues and solutions for the Media DB application.

## Environment Setup Issues

### Frontend Environment Variables Not Loading

**Symptoms:**
- Auth Test page is blank
- Environment variables show as "NOT SET" in browser
- Supabase client initialization fails

**Solutions:**

1. **Check .env.local file exists and has correct location:**
   ```bash
   # File should be at: frontend/.env.local
   # NOT at: frontend/src/.env.local
   ```

2. **Verify file contents:**
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   - No quotes around values
   - No spaces around `=`
   - Variables must start with `VITE_` prefix

3. **Restart Vite dev server:**
   ```bash
   # Vite only loads .env files on startup!
   # Stop current server: Ctrl+C
   npm run dev
   # Hard refresh browser: Ctrl+Shift+R
   ```

4. **Check file encoding:**
   - Must be UTF-8 (no BOM)
   - Windows: Use VS Code or Notepad++
   - Verify: Right-click file → Properties → encoding

### Backend Environment Variables Not Loading

**Symptoms:**
- `Configuration failed: Missing required environment variables`
- Server won't start
- `.env` file exists but variables not recognized

**Solutions:**

1. **Check .env file location:**
   ```bash
   # File should be at: backend/.env
   ```

2. **Verify file contents:**
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   FLASK_ENV=development
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **Check file encoding:**
   - Must be UTF-8 without BOM
   - Recreate file if needed:
     ```bash
     # Delete old file
     rm .env
     # Create new file with UTF-8 encoding
     # Copy contents from .env.example
     ```

4. **Activate virtual environment:**
   ```bash
   # Windows PowerShell:
   .venv\Scripts\Activate.ps1
   
   # Windows CMD:
   .venv\Scripts\activate.bat
   
   # Unix/Mac:
   source .venv/bin/activate
   ```

## Authentication Issues

### Magic Link Not Working

**Symptoms:**
- Email not received
- Magic link doesn't redirect back
- "Invalid magic link" error

**Solutions:**

1. **Check email settings:**
   - Look in spam folder
   - Verify email address is correct
   - Check Supabase Dashboard → Authentication → Settings → Email Auth is enabled

2. **Check redirect URL:**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add `http://localhost:3000` to allowed redirect URLs
   - For production, add your production domain

3. **Check email template:**
   - Supabase Dashboard → Authentication → Email Templates
   - Ensure "Confirm signup" or "Magic Link" template is enabled
   - Verify template has `{{ .ConfirmationURL }}` or `{{ .Token }}`

4. **Rate limiting:**
   - Wait a few minutes if you've sent many requests
   - Check Supabase logs for rate limit errors

### 401 Unauthorized Errors

**Symptoms:**
- Backend returns 401 when calling `/api/me`
- "Test Backend Auth" button fails
- Browser console shows 401 errors

**Solutions:**

1. **Verify you're signed in:**
   - Check if Supabase session exists:
     ```javascript
     // In browser console:
     const { data } = await supabase.auth.getSession();
     console.log(data.session);
     ```

2. **Check token is being sent:**
   - Open browser DevTools → Network
   - Click "Test Backend Auth"
   - Check request has `Authorization: Bearer <token>` header

3. **Verify backend can validate token:**
   - Check backend logs for specific error
   - Common errors:
    - `jwks_unavailable` → Network connectivity issue
     - `invalid_issuer` → Frontend/backend using different Supabase projects
     - `token_expired` → Session expired, sign in again

4. **Check CORS:**
   - Verify backend `ALLOWED_ORIGINS` includes `http://localhost:3000`
   - Check browser console for CORS errors

### Auth Key Set Issues

**Symptoms:**
- `jwks_unavailable` error
- `key_not_found` error
- Authentication fails intermittently

**Solutions:**

1. **Check internet connectivity:**
   - Backend needs to reach the Supabase auth key set endpoint
   - Test the endpoint in a browser

2. **Verify Supabase project:**
   - Check `SUPABASE_URL` matches your actual project
   - Go to Supabase Dashboard → Settings → API → Project URL

3. **Firewall/proxy:**
   - Ensure no firewall blocking outbound HTTPS
   - Check corporate proxy settings
   - Add exception for `*.supabase.co`

4. **Key set cache:**
   - App caches the auth key set for 10 minutes
   - Restart server to clear cache
   - Check logs for key set refresh events

## Database Issues

### Database Migration Errors

**Symptoms:**
- `relation 'profiles' does not exist`
- `relation 'works' does not exist`
- User creation fails with database error

**Solutions:**

1. **Apply migrations:**
   ```bash
   # Option 1: Using Supabase CLI
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   
   # Option 2: Manual via SQL Editor
   # Copy contents of migration files and run in Supabase SQL Editor
   ```

2. **Check migration status:**
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM supabase_migrations.schema_migrations;
   ```

3. **Verify tables exist:**
   ```sql
   -- In Supabase SQL Editor
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

4. **Reset database (CAUTION: Deletes all data):**
   ```bash
   npx supabase db reset
   ```

### RLS Policy Errors

**Symptoms:**
- `new row violates row-level security policy`
- Users can see other users' data
- Cannot insert/update own data

**Solutions:**

1. **Verify RLS is enabled:**
   ```sql
   -- In Supabase SQL Editor
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

2. **Check policies exist:**
   ```sql
   SELECT schemaname, tablename, policyname, cmd
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

3. **Test policies:**
   - Use "Run as user" feature in Supabase SQL Editor
   - Select a test user UUID
   - Try queries to verify access

4. **Reapply RLS policies:**
   - Run the `fix_profile_trigger.sql` migration
   - Check for syntax errors in policy definitions

### Profile Creation Fails

**Symptoms:**
- "Database error saving new user"
- New user created but no profile
- Cannot sign up

**Solutions:**

1. **Check trigger exists:**
   ```sql
   SELECT tgname, tgenabled 
   FROM pg_trigger 
   WHERE tgname = 'on_auth_user_created';
   ```

2. **Check function exists:**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'create_profile_for_new_user';
   ```

3. **Manually create profile:**
   ```sql
   -- Get user ID from Supabase Dashboard → Authentication → Users
   INSERT INTO profiles (id, username)
   VALUES ('user-uuid-here', 'username')
   ON CONFLICT (id) DO NOTHING;
   ```

4. **Reapply trigger migration:**
   - Run `supabase/migrations/20250820011210_fix_profile_trigger.sql`

## Development Server Issues

### Backend Won't Start

**Symptoms:**
- Server crashes on startup
- `ModuleNotFoundError` errors
- Port already in use

**Solutions:**

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Check Python version:**
   ```bash
   python --version  # Should be 3.11+
   ```

3. **Port conflict:**
   ```bash
   # Check what's using port 5000
   # Windows:
   netstat -ano | findstr :5000
   
   # Unix/Mac:
   lsof -i :5000
   
   # Kill process or use different port
   ```

4. **Check virtual environment:**
   ```bash
   # Should see (.venv) prefix in terminal
   # If not:
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # Unix/Mac
   ```

### Frontend Won't Start

**Symptoms:**
- `npm run dev` fails
- Module not found errors
- Port 3000 in use

**Solutions:**

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Clear node_modules and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check Node version:**
   ```bash
   node --version  # Should be 18+
   ```

4. **Port conflict:**
   ```bash
   # Kill process using port 3000 or
   # Edit vite.config.ts to use different port
   ```

## Performance Issues

### Slow Authentication Responses

**Symptoms:**
- `/api/me` takes > 2 seconds
- Intermittent timeouts
- Auth key set fetch delays

**Solutions:**

1. **Check key set cache:**
   - Cache is valid for 10 minutes
   - First request after cache expiry will be slower
   - This is expected behavior

2. **Network latency:**
   - Check connection to Supabase
   - Use `curl` to test the auth key set endpoint directly

3. **Database query optimization:**
   - Add indexes if querying large datasets
   - Check slow query logs in Supabase

### Slow Database Queries

**Symptoms:**
- Library page loads slowly
- Search takes too long
- Timeouts on large datasets

**Solutions:**

1. **Add indexes:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_works_title ON works(title);
   CREATE INDEX IF NOT EXISTS idx_works_type_year ON works(type, year);
   CREATE INDEX IF NOT EXISTS idx_user_items_user_id ON user_items(user_id);
   ```

2. **Use pagination:**
   - Limit query results
   - Implement cursor-based pagination
   - Add `limit` and `offset` to queries

3. **Check query plans:**
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM works WHERE title ILIKE '%matrix%';
   ```

## Testing Issues

### Tests Fail with Emoji Errors

**Symptoms:**
- `UnicodeEncodeError: 'charmap' codec can't encode character`
- Tests fail on Windows

**Solution:**
- This has been fixed in current versions
- All emojis replaced with text markers like `[PASS]`, `[FAIL]`
- If you see this, ensure you have latest code

### RLS Tests Fail

**Symptoms:**
- `Missing required environment variables`
- Cannot connect to database

**Solutions:**

1. **Set environment variables:**
   - Ensure `backend/.env` has all required variables
   - Include `SUPABASE_ANON_KEY`

2. **Run with real credentials:**
   - RLS tests require actual Supabase connection
   - Cannot use test/mock credentials

## Production Issues

### Deployment Fails

**Symptoms:**
- Build errors
- Environment variables not set
- Service won't start

**Solutions:**

1. **Check environment variables:**
   - Verify all required vars are set in hosting platform
   - Use production Supabase URL and keys
   - Set `FLASK_ENV=production`

2. **Build frontend:**
   ```bash
   cd frontend
   npm run build
   # Check dist/ folder for output
   ```

3. **Test production build locally:**
   ```bash
   npm run preview
   ```

## Getting Help

If issues persist:

1. **Check logs:**
   - Backend: Console output from `python wsgi.py`
   - Frontend: Browser console (F12)
   - Supabase: Dashboard → Logs

2. **Enable verbose logging:**
   - Backend: Set `FLASK_ENV=development`
   - Check detailed error messages in logs

3. **Review documentation:**
   - `README.md` - Setup instructions
   - `TESTING.md` - Test procedures
   - `SECURITY.md` - Security model
   - `AUTH_TESTS.md` - Auth testing details
   - `DATABASE_SETUP.md` - Database setup guide

4. **Common patterns:**
   - Most auth issues → Check environment variables
   - Most database issues → Run migrations
   - Most frontend issues → Restart dev server

