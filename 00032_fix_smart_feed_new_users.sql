
-- Actualiza get_smart_feed: novos utilizadores (sem seguidores) vêem posts em tendência de todos os utilizadores
CREATE OR REPLACE FUNCTION public.get_smart_feed(
  viewer_id    uuid,
  feed_user_ids uuid[],
  lim          integer DEFAULT 30
)
RETURNS TABLE(
  id               uuid,
  user_id          uuid,
  caption          text,
  image_url        text,
  image_urls       text[],
  video_url        text,
  likes_count      integer,
  comments_count   integer,
  views_count      integer,
  created_at       timestamptz,
  engagement_score numeric,
  profile_id       uuid,
  username         text,
  full_name        text,
  avatar_url       text,
  is_verified      boolean,
  community_id     uuid,
  community_name   text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.id, p.user_id, p.caption, p.image_url, p.image_urls,
    p.video_url, p.likes_count, p.comments_count, p.views_count,
    p.created_at,
    calculate_post_score(p.likes_count, p.comments_count, COALESCE(p.views_count,0), p.created_at) AS engagement_score,
    pr.id AS profile_id, pr.username, pr.full_name, pr.avatar_url, COALESCE(pr.is_verified, FALSE) AS is_verified,
    c.id AS community_id, c.name AS community_name
  FROM posts p
  JOIN profiles pr ON pr.id = p.user_id
  LEFT JOIN community_posts cp ON cp.post_id = p.id
  LEFT JOIN communities c ON c.id = cp.community_id
  WHERE
    -- Modo descoberta: utilizador novo (sem seguidores) → mostra todos os posts em tendência
    -- Modo feed normal: mostra posts de quem o utilizador segue + os próprios
    CASE
      WHEN array_length(feed_user_ids, 1) <= 1 THEN TRUE
      ELSE p.user_id = ANY(feed_user_ids)
    END
  ORDER BY engagement_score DESC, p.created_at DESC
  LIMIT lim;
$$;
