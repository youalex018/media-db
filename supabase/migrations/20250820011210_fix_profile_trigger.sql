-- Improved profile creation trigger that handles errors gracefully
-- This replaces the trigger from the init migration with better error handling

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_profile_for_new_user();

-- Create improved trigger function
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_new_user();

-- Add comment for documentation
COMMENT ON FUNCTION create_profile_for_new_user() IS 
    'Automatically creates a profile entry when a new user signs up. Handles errors gracefully to prevent blocking user creation.';
    
-- Verify the trigger is active
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created' 
        AND tgenabled = 'O'
    ) THEN
        RAISE NOTICE '✅ Profile creation trigger is active and enabled';
    ELSE
        RAISE WARNING '❌ Profile creation trigger may not be properly configured';
    END IF;
END $$;
