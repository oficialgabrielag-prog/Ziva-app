
-- Fix storage: allow authenticated users to upload to any subfolder (posts, reels, voice, tts)
DROP POLICY IF EXISTS "ziva_images_insert_auth" ON storage.objects;
CREATE POLICY "ziva_images_insert_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ziva_images'
    AND auth.uid() IS NOT NULL
  );

-- Fix UPDATE policy to handle all folder structures (not just top-level user folders)
DROP POLICY IF EXISTS "ziva_images_update_own" ON storage.objects;
CREATE POLICY "ziva_images_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ziva_images'
    AND auth.uid() IS NOT NULL
  );

-- Fix DELETE policy to handle all folder structures
DROP POLICY IF EXISTS "ziva_images_delete_own" ON storage.objects;
CREATE POLICY "ziva_images_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ziva_images'
    AND auth.uid() IS NOT NULL
  );

-- Ensure reels RLS is correct
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_insert_own" ON public.reels;
CREATE POLICY "reels_insert_own" ON public.reels
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "reels_select_all" ON public.reels;
CREATE POLICY "reels_select_all" ON public.reels
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "reels_delete_own" ON public.reels;
CREATE POLICY "reels_delete_own" ON public.reels
  FOR DELETE USING (user_id = auth.uid());

-- Ensure posts RLS is correct
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT WITH CHECK (user_id = auth.uid());
