
-- ═══════════════════════════════════════════════════════════════════
-- ZIVA SMART ALGORITHM V1
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Colunas adicionais em posts ──────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS shares_count    integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count     integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_score  numeric   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT NULL;

UPDATE posts SET last_activity_at = created_at WHERE last_activity_at IS NULL;

-- ─── 2. Tabela: interacções do utilizador ────────────────────────
CREATE TABLE IF NOT EXISTS user_interactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id          uuid        REFERENCES posts(id) ON DELETE CASCADE,
  interaction_type text        NOT NULL,
  duration_ms      integer     DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_post ON user_interactions(post_id);
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_interactions' AND policyname='ui_select_own') THEN
    CREATE POLICY ui_select_own  ON user_interactions FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_interactions' AND policyname='ui_insert_auth') THEN
    CREATE POLICY ui_insert_auth ON user_interactions FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ─── 3. Tabela: interesses do utilizador ─────────────────────────
CREATE TABLE IF NOT EXISTS user_interests (
  user_id    uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic      text    NOT NULL,
  score      numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic)
);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id, score DESC);
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_interests' AND policyname='uinterests_select_own') THEN
    CREATE POLICY uinterests_select_own ON user_interests FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY uinterests_upsert_own ON user_interests FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY uinterests_update_own ON user_interests FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- ─── 4. Tabela: horas de actividade do utilizador ────────────────
CREATE TABLE IF NOT EXISTS user_activity_hours (
  user_id        uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hour_of_day    integer NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  activity_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, hour_of_day)
);
ALTER TABLE user_activity_hours ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_activity_hours' AND policyname='uah_select_own') THEN
    CREATE POLICY uah_select_own ON user_activity_hours FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY uah_upsert_own ON user_activity_hours FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY uah_update_own ON user_activity_hours FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- ─── 5. Função de scoring melhorada ──────────────────────────────
CREATE OR REPLACE FUNCTION calculate_post_score(
  p_likes    int,
  p_comments int,
  p_views    int,
  p_created  timestamptz,
  p_shares   int DEFAULT 0,
  p_saves    int DEFAULT 0,
  p_trending numeric DEFAULT 0
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT (
    (p_likes    * 3.0) +
    (p_comments * 5.0) +
    (p_views    * 0.3) +
    (p_shares   * 6.0) +
    (p_saves    * 4.0) +
    (p_trending * 20.0)
  ) / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - p_created)) / 3600.0 + 2) ^ 1.5;
$$;

-- ─── 6. Feed Inteligente V2 ───────────────────────────────────────
DROP FUNCTION IF EXISTS get_smart_feed(uuid, uuid[], int);
CREATE FUNCTION get_smart_feed(
  viewer_id     uuid,
  feed_user_ids uuid[],
  lim           int DEFAULT 30
)
RETURNS TABLE(
  id               uuid,
  user_id          uuid,
  caption          text,
  image_url        text,
  image_urls       text[],
  video_url        text,
  likes_count      int,
  comments_count   int,
  views_count      int,
  shares_count     int,
  saves_count      int,
  created_at       timestamptz,
  engagement_score numeric,
  post_type        text,
  community_id     uuid,
  community_name   text,
  profile_id       uuid,
  username         text,
  full_name        text,
  avatar_url       text,
  is_verified      boolean,
  is_resurging     boolean
)
LANGUAGE sql SECURITY DEFINER AS $$
WITH
  viewer_follows AS (
    SELECT following_id FROM follows WHERE follower_id = viewer_id
  ),
  mutual_follows AS (
    SELECT f1.following_id AS uid
    FROM follows f1
    WHERE f1.follower_id = viewer_id
      AND EXISTS (
        SELECT 1 FROM follows f2
        WHERE f2.follower_id = f1.following_id AND f2.following_id = viewer_id
      )
  ),
  viewer_interests AS (
    SELECT topic, score FROM user_interests WHERE user_id = viewer_id ORDER BY score DESC LIMIT 20
  ),
  candidates AS (
    SELECT
      p.id,
      p.user_id,
      p.caption,
      p.image_url,
      p.image_urls,
      p.video_url,
      p.likes_count,
      p.comments_count,
      p.views_count,
      p.shares_count,
      p.saves_count,
      p.created_at,
      p.post_type,
      p.trending_score,
      p.last_activity_at,
      pr.id          AS profile_id,
      pr.username,
      pr.full_name,
      pr.avatar_url,
      COALESCE(pr.is_verified, false) AS is_verified,
      comm.id        AS comm_id,
      comm.name      AS comm_name,
      CASE
        WHEN mf.uid IS NOT NULL     THEN 25
        WHEN vf.following_id IS NOT NULL THEN 12
        ELSE 3
      END AS affinity_bonus,
      COALESCE((
        SELECT SUM(vi.score) * 8
        FROM viewer_interests vi
        WHERE p.caption ILIKE '%' || vi.topic || '%'
        LIMIT 1
      ), 0) AS interest_bonus,
      CASE
        WHEN p.created_at < NOW() - INTERVAL '7 days'
          AND p.last_activity_at > NOW() - INTERVAL '3 days'
        THEN true ELSE false
      END AS is_resurging
    FROM posts p
    JOIN profiles pr ON pr.id = p.user_id
    LEFT JOIN community_posts cp ON cp.post_id = p.id
    LEFT JOIN communities comm ON comm.id = cp.community_id
    LEFT JOIN viewer_follows vf ON vf.following_id = p.user_id
    LEFT JOIN mutual_follows mf ON mf.uid = p.user_id
    WHERE
      p.status = 'published'
      AND p.is_deleted = false
      AND (
        (array_length(feed_user_ids, 1) <= 1)
        OR p.user_id = ANY(feed_user_ids)
        OR p.trending_score > 0.5
      )
  ),
  scored AS (
    SELECT
      c.*,
      calculate_post_score(
        c.likes_count, c.comments_count, COALESCE(c.views_count,0),
        c.created_at, COALESCE(c.shares_count,0), COALESCE(c.saves_count,0), c.trending_score
      )
      + c.affinity_bonus
      + c.interest_bonus
      + CASE WHEN c.is_resurging THEN 15 ELSE 0 END
      AS total_score,
      ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at DESC) AS author_rank
    FROM candidates c
  )
SELECT
  s.id, s.user_id, s.caption, s.image_url, s.image_urls,
  s.video_url, s.likes_count, s.comments_count, s.views_count,
  COALESCE(s.shares_count, 0), COALESCE(s.saves_count, 0),
  s.created_at, s.total_score AS engagement_score,
  s.post_type, s.comm_id, s.comm_name,
  s.profile_id, s.username, s.full_name, s.avatar_url, s.is_verified,
  s.is_resurging
FROM scored s
WHERE s.author_rank <= 2
ORDER BY s.total_score DESC, s.created_at DESC
LIMIT lim;
$$;

-- ─── 7. RPC: Posts em Tendência ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_trending_posts(lim int DEFAULT 20)
RETURNS TABLE(
  id             uuid,
  caption        text,
  image_url      text,
  video_url      text,
  post_type      text,
  likes_count    int,
  comments_count int,
  views_count    int,
  created_at     timestamptz,
  trending_score numeric,
  profile_id     uuid,
  username       text,
  avatar_url     text,
  is_verified    boolean
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id, p.caption, p.image_url, p.video_url, p.post_type,
    p.likes_count, p.comments_count, COALESCE(p.views_count,0),
    p.created_at,
    calculate_post_score(
      p.likes_count, p.comments_count, COALESCE(p.views_count,0),
      p.created_at, COALESCE(p.shares_count,0), COALESCE(p.saves_count,0), 0
    ) AS trending_score,
    pr.id, pr.username, pr.avatar_url, COALESCE(pr.is_verified, false)
  FROM posts p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE p.status = 'published' AND p.is_deleted = false
    AND p.created_at > NOW() - INTERVAL '72 hours'
  ORDER BY trending_score DESC, p.likes_count DESC
  LIMIT lim;
$$;

-- ─── 8. RPC: Criadores em Crescimento ────────────────────────────
CREATE OR REPLACE FUNCTION get_rising_creators(viewer uuid, lim int DEFAULT 10)
RETURNS TABLE(
  id               uuid,
  username         text,
  full_name        text,
  avatar_url       text,
  followers_count  int,
  is_verified      boolean,
  posts_count      int,
  recent_engagement numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    pr.id, pr.username, pr.full_name, pr.avatar_url,
    pr.followers_count, COALESCE(pr.is_verified, false),
    pr.posts_count,
    COALESCE(SUM(
      p.likes_count + p.comments_count * 2 + COALESCE(p.shares_count,0) * 3
    ), 0) AS recent_engagement
  FROM profiles pr
  LEFT JOIN posts p ON p.user_id = pr.id
    AND p.created_at > NOW() - INTERVAL '7 days'
    AND p.status = 'published'
    AND p.is_deleted = false
  WHERE
    pr.id != viewer
    AND NOT EXISTS (
      SELECT 1 FROM follows WHERE follower_id = viewer AND following_id = pr.id
    )
  GROUP BY pr.id
  ORDER BY recent_engagement DESC, pr.followers_count DESC
  LIMIT lim;
$$;

-- ─── 9. Trigger: last_activity_at ────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_post_last_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    UPDATE posts SET last_activity_at = NOW() WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_likes_last_activity    ON likes;
DROP TRIGGER IF EXISTS trg_comments_last_activity ON comments;
CREATE TRIGGER trg_likes_last_activity
  AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION fn_update_post_last_activity();
CREATE TRIGGER trg_comments_last_activity
  AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION fn_update_post_last_activity();

-- ─── 10. Trigger: saves_count ────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_saves_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET saves_count = GREATEST(0, COALESCE(saves_count,0) + 1),
                     last_activity_at = NOW()
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET saves_count = GREATEST(0, COALESCE(saves_count,0) - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_saved_posts_count ON saved_posts;
CREATE TRIGGER trg_saved_posts_count
  AFTER INSERT OR DELETE ON saved_posts
  FOR EACH ROW EXECUTE FUNCTION fn_update_saves_count();

-- ─── 11. Actualizar trending scores inicialmente ─────────────────
CREATE OR REPLACE FUNCTION refresh_trending_scores()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE posts SET trending_score =
    GREATEST(0, LEAST(1,
      calculate_post_score(
        likes_count, comments_count, COALESCE(views_count,0),
        created_at, COALESCE(shares_count,0), COALESCE(saves_count,0), 0
      ) / 100.0
    ))
  WHERE status = 'published' AND is_deleted = false
    AND created_at > NOW() - INTERVAL '14 days';
$$;
SELECT refresh_trending_scores();

-- ─── 12. Grupos de notificações ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_grouped_notifications(uid uuid, lim int DEFAULT 40)
RETURNS TABLE(
  group_key             text,
  notif_type            text,
  post_id               uuid,
  live_id               uuid,
  actor_count           bigint,
  last_actor_id         uuid,
  last_actor_username   text,
  last_actor_avatar     text,
  second_actor_username text,
  message               text,
  is_read               boolean,
  latest_at             timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH grouped AS (
    SELECT
      COALESCE(n.post_id::text, n.live_id::text, 'system') || '_' || n.type AS group_key,
      n.type AS notif_type,
      n.post_id,
      n.live_id,
      COUNT(DISTINCT n.actor_id) AS actor_count,
      (ARRAY_AGG(n.actor_id    ORDER BY n.created_at DESC))[1] AS last_actor_id,
      (ARRAY_AGG(pr.username   ORDER BY n.created_at DESC))[1] AS last_actor_username,
      (ARRAY_AGG(pr.avatar_url ORDER BY n.created_at DESC))[1] AS last_actor_avatar,
      (ARRAY_AGG(pr.username   ORDER BY n.created_at DESC))[2] AS second_actor_username,
      MAX(n.message) AS message,
      BOOL_AND(n.is_read) AS is_read,
      MAX(n.created_at) AS latest_at
    FROM notifications n
    LEFT JOIN profiles pr ON pr.id = n.actor_id
    WHERE n.user_id = uid
      AND n.created_at > NOW() - INTERVAL '7 days'
    GROUP BY group_key, n.type, n.post_id, n.live_id
  )
  SELECT * FROM grouped ORDER BY latest_at DESC LIMIT lim;
$$;

-- ─── 13. Registo de interacção + actualização de interesses ───────
CREATE OR REPLACE FUNCTION track_user_interaction(
  p_user_id     uuid,
  p_post_id     uuid,
  p_type        text,
  p_duration_ms integer DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caption text;
  v_weight  numeric;
BEGIN
  INSERT INTO user_interactions(user_id, post_id, interaction_type, duration_ms)
  VALUES (p_user_id, p_post_id, p_type, p_duration_ms);

  v_weight := CASE p_type
    WHEN 'like'    THEN 3.0
    WHEN 'comment' THEN 5.0
    WHEN 'share'   THEN 6.0
    WHEN 'save'    THEN 4.0
    WHEN 'view'    THEN LEAST(1.0, p_duration_ms / 10000.0)
    WHEN 'click'   THEN 1.5
    ELSE 0.5
  END;

  INSERT INTO user_activity_hours(user_id, hour_of_day, activity_count)
  VALUES (p_user_id, EXTRACT(HOUR FROM NOW())::int, 1)
  ON CONFLICT (user_id, hour_of_day)
  DO UPDATE SET activity_count = user_activity_hours.activity_count + 1;

  SELECT p.caption INTO v_caption FROM posts p WHERE p.id = p_post_id;
  IF v_caption IS NOT NULL AND v_weight > 0 THEN
    INSERT INTO user_interests(user_id, topic, score, updated_at)
    SELECT p_user_id, lower(m[1]), v_weight, NOW()
    FROM regexp_matches(v_caption, '#([A-Za-z\u00C0-\u00FF0-9_]+)', 'g') AS m
    ON CONFLICT (user_id, topic)
    DO UPDATE SET
      score      = LEAST(100, user_interests.score + EXCLUDED.score * 0.3),
      updated_at = NOW();

    UPDATE user_interests
    SET score = score * 0.97
    WHERE user_id = p_user_id AND updated_at < NOW() - INTERVAL '1 day';
  END IF;
END;
$$;

-- ─── 14. Hashtags em tendência (48h) ─────────────────────────────
CREATE OR REPLACE FUNCTION get_trending_hashtags(lim int DEFAULT 12)
RETURNS TABLE(tag text, post_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    lower(m[1]) AS tag,
    count(*) AS post_count
  FROM posts,
    regexp_matches(caption, '#([A-Za-z\u00C0-\u00FF0-9_]+)', 'g') AS m
  WHERE created_at > now() - interval '48 hours'
    AND status = 'published'
    AND is_deleted = false
  GROUP BY lower(m[1])
  HAVING count(*) >= 1
  ORDER BY post_count DESC
  LIMIT lim;
$$;
