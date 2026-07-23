
-- 1. Drop and recreate the post_type check with all valid values
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_post_type_check
  CHECK (post_type IN ('post', 'photo', 'video', 'reel', 'story', 'community_post'));

-- 2. Ensure community_id column exists on posts (add if missing)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE SET NULL;

-- 3. Index for community_id queries
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id);

-- 4. Index for post_type queries (feeds and filters)
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);

-- 5. Backfill any existing reel entries in posts table missing post_type
UPDATE posts SET post_type = 'reel' WHERE video_url IS NOT NULL AND post_type IS NULL;
UPDATE posts SET post_type = 'video' WHERE video_url IS NOT NULL AND post_type NOT IN ('reel','story','community_post') AND post_type IS NULL;
UPDATE posts SET post_type = 'post' WHERE post_type IS NULL;
