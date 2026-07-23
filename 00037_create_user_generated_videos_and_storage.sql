
-- Tabela para armazenar vídeos gerados pela IA por utilizador
CREATE TABLE IF NOT EXISTS public.user_generated_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  video_url text NOT NULL,
  storage_url text,
  duration text DEFAULT '5',
  status text NOT NULL DEFAULT 'completed',
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ugv_user_id ON public.user_generated_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_ugv_created_at ON public.user_generated_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugv_task_id ON public.user_generated_videos(task_id);

ALTER TABLE public.user_generated_videos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_generated_videos' AND policyname='ugv_select_own') THEN
    CREATE POLICY "ugv_select_own" ON public.user_generated_videos FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_generated_videos' AND policyname='ugv_insert_own') THEN
    CREATE POLICY "ugv_insert_own" ON public.user_generated_videos FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_generated_videos' AND policyname='ugv_update_own') THEN
    CREATE POLICY "ugv_update_own" ON public.user_generated_videos FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_generated_videos' AND policyname='ugv_delete_own') THEN
    CREATE POLICY "ugv_delete_own" ON public.user_generated_videos FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Bucket de media gerada pela IA
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-media',
  'generated-media',
  true,
  524288000,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='generated_media_public_read') THEN
    CREATE POLICY "generated_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'generated-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='generated_media_service_insert') THEN
    CREATE POLICY "generated_media_service_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-media');
  END IF;
END $$;
