
-- Drop old signatures before recreating with new return types
DROP FUNCTION IF EXISTS get_grouped_notifications(uuid, integer);
DROP FUNCTION IF EXISTS get_trending_posts(integer);
DROP FUNCTION IF EXISTS get_rising_creators(uuid, integer);

-- ── get_grouped_notifications ──────────────────────────────────────────────
CREATE FUNCTION get_grouped_notifications(uid uuid, lim int DEFAULT 50)
RETURNS TABLE (
  group_key             text,
  notif_type            text,
  post_id               uuid,
  live_id               uuid,
  is_read               boolean,
  latest_at             timestamptz,
  actor_count           int,
  last_actor_id         uuid,
  last_actor_username   text,
  last_actor_avatar     text,
  second_actor_username text,
  message               text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CONCAT(
      n.type, '|',
      COALESCE(n.post_id::text, n.live_id::text, 'none'), '|',
      TO_CHAR(DATE_TRUNC('week', n.created_at), 'IYYY-IW')
    )                                                        AS group_key,
    n.type                                                   AS notif_type,
    n.post_id,
    n.live_id,
    BOOL_AND(n.is_read)                                      AS is_read,
    MAX(n.created_at)                                        AS latest_at,
    COUNT(DISTINCT n.actor_id)::int                          AS actor_count,
    (ARRAY_AGG(n.actor_id   ORDER BY n.created_at DESC))[1]  AS last_actor_id,
    (ARRAY_AGG(p.username   ORDER BY n.created_at DESC))[1]  AS last_actor_username,
    (ARRAY_AGG(p.avatar_url ORDER BY n.created_at DESC))[1]  AS last_actor_avatar,
    (ARRAY_AGG(p.username   ORDER BY n.created_at DESC))[2]  AS second_actor_username,
    (ARRAY_AGG(n.message    ORDER BY n.created_at DESC))[1]  AS message
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_id
  WHERE n.user_id = uid
  GROUP BY n.type, n.post_id, n.live_id,
           TO_CHAR(DATE_TRUNC('week', n.created_at), 'IYYY-IW')
  ORDER BY MAX(n.created_at) DESC
  LIMIT lim;
$$;

-- ── get_trending_posts ─────────────────────────────────────────────────────
CREATE FUNCTION get_trending_posts(lim int DEFAULT 10)
RETURNS TABLE (
  id             uuid,
  caption        text,
  image_url      text,
  video_url      text,
  post_type      text,
  likes_count    int,
  trending_score float,
  username       text,
  avatar_url     text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.caption,
    p.image_url,
    p.video_url,
    p.post_type,
    p.likes_count,
    COALESCE(p.trending_score, 0)::float AS trending_score,
    pr.username,
    pr.avatar_url
  FROM posts p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE p.status = 'published'
    AND p.is_deleted = FALSE
    AND p.created_at >= NOW() - INTERVAL '72 hours'
  ORDER BY COALESCE(p.trending_score, 0) DESC, p.likes_count DESC
  LIMIT lim;
$$;

-- ── get_rising_creators ────────────────────────────────────────────────────
CREATE FUNCTION get_rising_creators(viewer uuid DEFAULT NULL, lim int DEFAULT 8)
RETURNS TABLE (
  id                uuid,
  username          text,
  full_name         text,
  avatar_url        text,
  followers_count   int,
  is_verified       boolean,
  posts_count       bigint,
  recent_engagement bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.id,
    pr.username,
    pr.full_name,
    pr.avatar_url,
    pr.followers_count,
    pr.is_verified,
    COUNT(DISTINCT p.id)                                          AS posts_count,
    COALESCE(SUM(p.likes_count + p.comments_count), 0)::bigint   AS recent_engagement
  FROM profiles pr
  JOIN posts p ON p.user_id = pr.id
    AND p.status = 'published'
    AND p.is_deleted = FALSE
    AND p.created_at >= NOW() - INTERVAL '7 days'
  WHERE (viewer IS NULL OR pr.id != viewer)
    AND (
      viewer IS NULL
      OR pr.id NOT IN (
        SELECT following_id FROM follows WHERE follower_id = viewer
      )
    )
  GROUP BY pr.id
  HAVING COUNT(DISTINCT p.id) >= 1
  ORDER BY recent_engagement DESC, pr.followers_count DESC
  LIMIT lim;
$$;
