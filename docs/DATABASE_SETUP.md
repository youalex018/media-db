# Database Setup Guide

## Problem: "Database error saving new user"

This error occurs because:
1. The database schema hasn't been applied to your Supabase project yet
2. The `profiles` table trigger is trying to create a profile but failing

## Solution: Apply Database Migrations

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Link your project**:
   ```bash
   supabase link --project-ref jxhtujifrkqzoxbfxcur
   ```

3. **Apply migrations**:
   ```bash
   supabase db push
   ```

### Option 2: Using Supabase Dashboard (Manual)

1. Go to Supabase SQL Editor

2. Copy the contents of `supabase/migrations/20250820011209_init_schema_and_policies.sql`

3. Paste into the SQL Editor and click "Run"

4. Verify success - you should see:
   ```
   Success. No rows returned
   ```

### Option 3: Apply via SQL Editor (Quick Fix)

If the full migration has issues, run this minimal version first:

```sql
-- 1. Create profiles table (if not exists)
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text,
    created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Create trigger to auto-create profile
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Try to insert profile, ignore if it already exists
    INSERT INTO profiles (id, username)
    VALUES (NEW.id, split_part(NEW.email, '@', 1))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger (replace if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_new_user();
```

## Improvements in Quick Fix

The improved trigger:

1. **Uses email prefix as username** instead of full email (avoids @ character issues)
2. **Handles conflicts gracefully** with `ON CONFLICT DO NOTHING`
3. **Catches errors** without failing user creation
4. **References `auth.users(id)`** properly with foreign key

## Verify Setup

After applying the migration, test user creation:

```sql
-- Check if profiles table exists
SELECT * FROM profiles;

-- Check if trigger exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Check policies
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename = 'profiles';
```

## Test User Sign-Up

1. Go to http://localhost:3000
2. Enter your email
3. Click "Send Magic Link"
4. Should now work without errors!

## Common Issues

### Issue 1: "relation 'profiles' does not exist"
**Solution**: Run the quick fix SQL above to create the table.

### Issue 2: "duplicate key value violates unique constraint"  
**Solution**: The improved trigger handles this with `ON CONFLICT DO NOTHING`.

### Issue 3: "permission denied for table profiles"
**Solution**: Make sure RLS policies are created (step 3 in quick fix).

### Issue 4: "password authentication failed"
**Solution**: When running `supabase link`, use your Supabase access token from the dashboard.

## Next Steps After Setup

Once the database is set up:

1. ✅ User sign-up will work
2. ✅ Profiles automatically created
3. ✅ RLS policies protect user data
4. Ready for Phase 3 (Search & Add features)

## Manual Profile Creation (If Trigger Fails)

If you need to manually create a profile for an existing user:

```sql
-- Get your user ID from Supabase Dashboard → Authentication → Users
INSERT INTO profiles (id, username)
VALUES ('your-user-uuid-here', 'your-username')
ON CONFLICT (id) DO NOTHING;
```

## Database Reset (If Needed)

To start fresh (⚠️ **This deletes all data!**):

```sql
-- Drop all tables
DROP TABLE IF EXISTS work_embeddings CASCADE;
DROP TABLE IF EXISTS sources CASCADE;
DROP TABLE IF EXISTS user_item_tags CASCADE;
DROP TABLE IF EXISTS user_tag_names CASCADE;
DROP TABLE IF EXISTS user_items CASCADE;
DROP TABLE IF EXISTS work_genres CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS work_people CASCADE;
DROP TABLE IF EXISTS people CASCADE;
DROP TABLE IF EXISTS works CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop types
DROP TYPE IF EXISTS read_status CASCADE;
DROP TYPE IF EXISTS work_type CASCADE;

-- Then run the full migration again
```
