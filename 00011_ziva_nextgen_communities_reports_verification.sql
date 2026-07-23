
-- ─── Verificação de conta nos perfis ─────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ;

-- ─── Sistema de denúncias ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('post','comment','profile','reel','story')),
  target_id     UUID NOT NULL,
  reason        TEXT NOT NULL,
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_auth" ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_select_own"  ON reports FOR SELECT USING (reporter_id = auth.uid());

-- ─── Comunidades ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  cover_url     TEXT,
  avatar_url    TEXT,
  is_private    BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  members_count INT  NOT NULL DEFAULT 1,
  posts_count   INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "communities_select_all"   ON communities FOR SELECT USING (true);
CREATE POLICY "communities_insert_auth"  ON communities FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "communities_update_owner" ON communities FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "communities_delete_owner" ON communities FOR DELETE USING (owner_id = auth.uid());

-- Membros de comunidades
CREATE TABLE IF NOT EXISTS community_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','moderator','member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_members_select_all"   ON community_members FOR SELECT USING (true);
CREATE POLICY "community_members_insert_auth"  ON community_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "community_members_delete_auth"  ON community_members FOR DELETE USING (user_id = auth.uid());

-- Posts de comunidades
CREATE TABLE IF NOT EXISTS community_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_id, post_id)
);
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_posts_select_all"  ON community_posts FOR SELECT USING (true);
CREATE POLICY "community_posts_insert_auth" ON community_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_posts.community_id AND user_id = auth.uid())
);

-- ─── RPC: incrementar/decrementar membros de comunidade ──────────────────────
CREATE OR REPLACE FUNCTION increment_community_members(cid UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE communities SET members_count = members_count + 1 WHERE id = cid;
$$;

CREATE OR REPLACE FUNCTION decrement_community_members(cid UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE communities SET members_count = GREATEST(0, members_count - 1) WHERE id = cid;
$$;

-- ─── Pontuação do feed (engagement score) ────────────────────────────────────
-- Calculado por trigger/RPC ao nível dos posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS engagement_score NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION calculate_post_score(
  p_likes INT, p_comments INT, p_views INT, p_created TIMESTAMPTZ
) RETURNS NUMERIC LANGUAGE SQL IMMUTABLE AS $$
  SELECT (
    (p_likes * 3.0) +
    (p_comments * 5.0) +
    (p_views * 0.5)
  ) / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - p_created)) / 3600.0 + 2) ^ 1.5;
$$;

-- RPC para obter feed inteligente
CREATE OR REPLACE FUNCTION get_smart_feed(viewer_id UUID, feed_user_ids UUID[], lim INT DEFAULT 30)
RETURNS TABLE (
  id UUID, user_id UUID, caption TEXT, image_url TEXT, image_urls TEXT[],
  video_url TEXT, likes_count INT, comments_count INT, views_count INT,
  created_at TIMESTAMPTZ, engagement_score NUMERIC,
  profile_id UUID, username TEXT, full_name TEXT, avatar_url TEXT, is_verified BOOLEAN
) LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT
    p.id, p.user_id, p.caption, p.image_url, p.image_urls,
    p.video_url, p.likes_count, p.comments_count, p.views_count,
    p.created_at,
    calculate_post_score(p.likes_count, p.comments_count, COALESCE(p.views_count,0), p.created_at) AS engagement_score,
    pr.id AS profile_id, pr.username, pr.full_name, pr.avatar_url, COALESCE(pr.is_verified, FALSE) AS is_verified
  FROM posts p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE p.user_id = ANY(feed_user_ids)
  ORDER BY engagement_score DESC, p.created_at DESC
  LIMIT lim;
$$;

-- ─── Analytics de criador ─────────────────────────────────────────────────────
-- Tabela de eventos de visualização de posts
CREATE TABLE IF NOT EXISTS post_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_views_select_own" ON post_views FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "post_views_insert_auth" ON post_views FOR INSERT WITH CHECK (user_id = auth.uid());

-- RPC analytics do criador
CREATE OR REPLACE FUNCTION get_creator_stats(creator_id UUID)
RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total_posts',    (SELECT COUNT(*) FROM posts WHERE user_id = creator_id),
    'total_likes',    (SELECT COALESCE(SUM(likes_count),0) FROM posts WHERE user_id = creator_id),
    'total_comments', (SELECT COALESCE(SUM(comments_count),0) FROM posts WHERE user_id = creator_id),
    'total_views',    (SELECT COALESCE(SUM(views_count),0) FROM posts WHERE user_id = creator_id),
    'total_reels',    (SELECT COUNT(*) FROM reels WHERE user_id = creator_id),
    'reel_views',     (SELECT COALESCE(SUM(views_count),0) FROM reels WHERE user_id = creator_id),
    'followers',      (SELECT COALESCE(followers_count,0) FROM profiles WHERE id = creator_id),
    'top_post',       (SELECT row_to_json(t) FROM (
                        SELECT id, caption, image_url, likes_count, comments_count
                        FROM posts WHERE user_id = creator_id
                        ORDER BY likes_count DESC LIMIT 1
                      ) t)
  );
$$;
