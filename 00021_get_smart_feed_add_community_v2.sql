
DROP FUNCTION IF EXISTS get_smart_feed(UUID, UUID[], INT);

CREATE FUNCTION get_smart_feed(viewer_id UUID, feed_user_ids UUID[], lim INT DEFAULT 30)
RETURNS TABLE (
  id UUID, user_id UUID, caption TEXT, image_url TEXT, image_urls TEXT[],
  video_url TEXT, likes_count INT, comments_count INT, views_count INT,
  created_at TIMESTAMPTZ, engagement_score NUMERIC,
  profile_id UUID, username TEXT, full_name TEXT, avatar_url TEXT, is_verified BOOLEAN,
  community_id UUID, community_name TEXT
) LANGUAGE SQL SECURITY DEFINER AS $$
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
  WHERE p.user_id = ANY(feed_user_ids)
  ORDER BY engagement_score DESC, p.created_at DESC
  LIMIT lim;
$$;
