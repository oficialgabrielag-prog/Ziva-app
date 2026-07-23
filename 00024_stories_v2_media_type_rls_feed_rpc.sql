
-- 1. Adicionar media_type à tabela stories
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image','video')),
  ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 5; -- duração em segundos para vídeos

-- 2. Adicionar font_size e high_contrast ao user_settings se não existirem
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS font_size TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS high_contrast BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notifications_messages BOOLEAN NOT NULL DEFAULT true;

-- 3. RLS para stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_select_all"    ON stories;
DROP POLICY IF EXISTS "stories_insert_own"    ON stories;
DROP POLICY IF EXISTS "stories_delete_own"    ON stories;

CREATE POLICY "stories_select_all" ON stories FOR SELECT USING (true);
CREATE POLICY "stories_insert_own" ON stories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "stories_delete_own" ON stories FOR DELETE USING (user_id = auth.uid());

-- RLS para story_views
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_views_select" ON story_views;
DROP POLICY IF EXISTS "story_views_insert" ON story_views;

CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (true);
CREATE POLICY "story_views_insert" ON story_views FOR INSERT WITH CHECK (user_id = auth.uid());

-- 4. Índices de performance
CREATE INDEX IF NOT EXISTS idx_stories_user_expires
  ON stories(user_id, expires_at DESC);

-- 5. RPC: obter stories do feed (próprias + de quem sigo, últimas 24h)
CREATE OR REPLACE FUNCTION get_stories_feed(viewer_id UUID)
RETURNS TABLE (
  story_id    UUID,
  story_user_id UUID,
  media_url   TEXT,
  media_type  TEXT,
  text_overlay TEXT,
  text_color  TEXT,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ,
  duration    INTEGER,
  username    TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  is_verified BOOLEAN,
  viewed      BOOLEAN
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    s.id           AS story_id,
    s.user_id      AS story_user_id,
    s.media_url,
    s.media_type,
    s.text_overlay,
    s.text_color,
    s.expires_at,
    s.created_at,
    COALESCE(s.duration, 5) AS duration,
    pr.username,
    pr.full_name,
    pr.avatar_url,
    COALESCE(pr.is_verified, FALSE) AS is_verified,
    EXISTS (
      SELECT 1 FROM story_views sv
      WHERE sv.story_id = s.id AND sv.user_id = viewer_id
    ) AS viewed
  FROM stories s
  JOIN profiles pr ON pr.id = s.user_id
  WHERE
    s.expires_at > NOW()
    AND (
      s.user_id = viewer_id
      OR s.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = viewer_id
      )
    )
  ORDER BY
    s.user_id = viewer_id DESC,  -- próprias stories primeiro
    s.created_at DESC;
$$;

-- 6. RPC: registar visualização de story
CREATE OR REPLACE FUNCTION view_story(p_story_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO story_views (story_id, user_id)
  VALUES (p_story_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;
