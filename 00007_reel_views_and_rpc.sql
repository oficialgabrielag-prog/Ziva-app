
ALTER TABLE reels ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_reel_views(reel_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE reels SET views_count = COALESCE(views_count, 0) + 1 WHERE id = reel_id_arg;
$$;

CREATE OR REPLACE FUNCTION increment_reel_comments(reel_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE reels SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = reel_id_arg;
$$;
