-- Optimize RLS policies for performance
-- Replace auth.uid() with (select auth.uid()) to prevent re-evaluation per row
-- This significantly improves query performance at scale

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can manage own items" ON user_items;
DROP POLICY IF EXISTS "Users can manage own tag names" ON user_tag_names;
DROP POLICY IF EXISTS "Users can manage own item tags" ON user_item_tags;

-- Recreate policies with optimized auth.uid() calls

-- Profiles policies (users can only access their own profile)
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- User-scoped table policies (user_items, user_tag_names, user_item_tags)
CREATE POLICY "Users can manage own items" ON user_items
    FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own tag names" ON user_tag_names
    FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own item tags" ON user_item_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_items ui 
            WHERE ui.id = user_item_tags.user_item_id 
            AND ui.user_id = (select auth.uid())
        )
    );

