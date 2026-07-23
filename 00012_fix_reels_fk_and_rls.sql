-- Fix reels.user_id FK: change from auth.users to profiles so PostgREST join works
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_user_id_fkey;
ALTER TABLE public.reels ADD CONSTRAINT reels_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix reel_likes FK too
ALTER TABLE public.reel_likes DROP CONSTRAINT IF EXISTS reel_likes_user_id_fkey;
ALTER TABLE public.reel_likes ADD CONSTRAINT reel_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure stories table has proper RLS
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_select_all" ON stories;
DROP POLICY IF EXISTS "stories_insert_own" ON stories;
DROP POLICY IF EXISTS "stories_delete_own" ON stories;
CREATE POLICY "stories_select_all" ON stories FOR SELECT USING (true);
CREATE POLICY "stories_insert_own" ON stories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "stories_delete_own" ON stories FOR DELETE USING (user_id = auth.uid());

-- Fix community_posts insert policy: allow any authenticated user to post
DROP POLICY IF EXISTS "community_posts_insert_auth" ON community_posts;
CREATE POLICY "community_posts_insert_auth" ON community_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow community post delete
DROP POLICY IF EXISTS "community_posts_delete_auth" ON community_posts;
CREATE POLICY "community_posts_delete_auth" ON community_posts FOR DELETE USING (auth.uid() IS NOT NULL);