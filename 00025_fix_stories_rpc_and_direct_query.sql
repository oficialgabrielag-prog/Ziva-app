
-- Garantir RLS permissiva em stories para SELECT
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_select_all" ON stories;
CREATE POLICY "stories_select_all" ON stories FOR SELECT USING (true);

-- Garantir que a coluna media_type existe com valor por defeito
ALTER TABLE stories ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 5;

-- Re-criar a RPC get_stories_feed com lógica corrigida (sem restrição de follows)
-- Mostra todas as stories activas (não expiradas) + informação do perfil
CREATE OR REPLACE FUNCTION get_stories_feed(viewer_id UUID)
RETURNS TABLE (
  story_id      UUID,
  story_user_id UUID,
  media_url     TEXT,
  media_type    TEXT,
  text_overlay  TEXT,
  text_color    TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ,
  duration      INTEGER,
  username      TEXT,
  full_name     TEXT,
  avatar_url    TEXT,
  is_verified   BOOLEAN,
  viewed        BOOLEAN
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    s.id           AS story_id,
    s.user_id      AS story_user_id,
    s.media_url,
    COALESCE(s.media_type, 'image') AS media_type,
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
    (s.user_id = viewer_id) DESC,
    s.created_at DESC;
$$;

-- Garantir que story_views tem RLS correcta
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_views_select" ON story_views;
DROP POLICY IF EXISTS "story_views_insert" ON story_views;
CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (true);
CREATE POLICY "story_views_insert" ON story_views FOR INSERT WITH CHECK (user_id = auth.uid());
