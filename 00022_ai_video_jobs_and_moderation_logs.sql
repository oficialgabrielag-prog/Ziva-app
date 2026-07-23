
-- Tabela para registar jobs de geração de vídeo IA
CREATE TABLE IF NOT EXISTS ai_video_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  task_id      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('submitted','processing','succeed','failed')),
  prompt       TEXT,
  image_url    TEXT,
  video_url    TEXT,
  duration     TEXT,
  aspect_ratio TEXT DEFAULT '9:16',
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_video_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_jobs_select_own"  ON ai_video_jobs FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "video_jobs_insert_own"  ON ai_video_jobs FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "video_jobs_update_own"  ON ai_video_jobs FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "video_jobs_delete_own"  ON ai_video_jobs FOR DELETE  USING (user_id = auth.uid());

-- Índice por user_id + status para listar jobs ativos
CREATE INDEX IF NOT EXISTS idx_ai_video_jobs_user ON ai_video_jobs(user_id, created_at DESC);

-- Tabela de logs de moderação de conteúdo
CREATE TABLE IF NOT EXISTS moderation_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL,
  content_snippet TEXT,
  safety_score   INT NOT NULL DEFAULT 0,
  categories     TEXT[] DEFAULT '{}',
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
-- Apenas admins/service_role lêem logs; utilizadores não têm acesso
CREATE POLICY "moderation_logs_no_user_access" ON moderation_logs FOR SELECT USING (false);
CREATE POLICY "moderation_logs_service_insert" ON moderation_logs FOR INSERT WITH CHECK (true);

-- Storage bucket para vídeos gerados (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('generated-media', 'generated-media', true, 209715200, ARRAY['video/mp4','video/mov','video/webm','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "generated_media_public_read"   ON storage.objects FOR SELECT  USING (bucket_id = 'generated-media');
CREATE POLICY "generated_media_auth_insert"   ON storage.objects FOR INSERT  WITH CHECK (bucket_id = 'generated-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "generated_media_owner_delete"  ON storage.objects FOR DELETE  USING (bucket_id = 'generated-media' AND owner = auth.uid());
