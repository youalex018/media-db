-- Security fixes for Supabase recommendations
-- 1. Move extensions to dedicated schema
-- 2. Fix functions with mutable search_path

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move extensions from public to extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Grant usage on extensions schema to all necessary roles
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Add comment for documentation
COMMENT ON SCHEMA extensions IS 'Dedicated schema for PostgreSQL extensions (pgvector, pg_trgm, etc.) - isolated from public schema for security best practices';

-- Fix: Function with role mutable search_path (create_profile_for_new_user)
-- Drop trigger first to avoid dependency errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Drop and recreate with SET search_path
DROP FUNCTION IF EXISTS public.create_profile_for_new_user();

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Try to insert profile with email prefix as username
    -- This avoids issues with @ symbols and special characters
    INSERT INTO profiles (id, username)
    VALUES (
        NEW.id, 
        COALESCE(
            split_part(NEW.email, '@', 1),  -- Use part before @ as username
            'user_' || substring(NEW.id::text, 1, 8)  -- Fallback to user_<uuid-prefix>
        )
    )
    ON CONFLICT (id) DO NOTHING;  -- Ignore if profile already exists
    
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- If username is taken, try with UUID suffix
        BEGIN
            INSERT INTO profiles (id, username)
            VALUES (
                NEW.id,
                split_part(NEW.email, '@', 1) || '_' || substring(NEW.id::text, 1, 4)
            )
            ON CONFLICT (id) DO NOTHING;
            RETURN NEW;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail user creation
                RAISE WARNING 'Failed to create profile for user % (email: %): %', NEW.id, NEW.email, SQLERRM;
                RETURN NEW;
        END;
    WHEN OTHERS THEN
        -- Catch any other error and log it
        RAISE WARNING 'Unexpected error creating profile for user % (email: %): %', NEW.id, NEW.email, SQLERRM;
        RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_profile_for_new_user() IS 
    'Automatically creates a profile entry when a new user signs up. Handles errors gracefully to prevent blocking user creation.';

-- Recreate the trigger (just to ensure it's properly linked)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_new_user();

-- Fix: Function with role mutable search_path (touch_updated_at)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.touch_updated_at() IS 
    'Updates the updated_at timestamp to current time. Used as a trigger function.';

