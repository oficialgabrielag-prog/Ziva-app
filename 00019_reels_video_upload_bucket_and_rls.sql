
-- 1. Criar bucket público para vídeos dos reels
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reels_videos',
  'reels_videos',
  true,
  524288000, -- 500 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg', 'video/3gpp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Políticas RLS para o bucket reels_videos
-- SELECT: qualquer pessoa pode ver (público)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='reels_videos_select_public') THEN
    CREATE POLICY "reels_videos_select_public" ON storage.objects
      FOR SELECT USING (bucket_id = 'reels_videos');
  END IF;
END $$;

-- INSERT: apenas utilizadores autenticados
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='reels_videos_insert_auth') THEN
    CREATE POLICY "reels_videos_insert_auth" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'reels_videos' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- DELETE: apenas o proprietário
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='reels_videos_delete_owner') THEN
    CREATE POLICY "reels_videos_delete_owner" ON storage.objects
      FOR DELETE USING (bucket_id = 'reels_videos' AND owner = auth.uid());
  END IF;
END $$;

-- 3. Garantir que a tabela reels tem todas as colunas necessárias
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- 4. Garantir RLS na tabela reels (INSERT para autenticados)
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='reels_insert_auth') THEN
    CREATE POLICY "reels_insert_auth" ON public.reels
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='reels_select_all') THEN
    CREATE POLICY "reels_select_all" ON public.reels
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='reels_delete_owner') THEN
    CREATE POLICY "reels_delete_owner" ON public.reels
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;
