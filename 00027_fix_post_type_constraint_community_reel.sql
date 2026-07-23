-- Drop and recreate the check with ALL valid post types
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_post_type_check
  CHECK (post_type IN ('post', 'photo', 'video', 'reel', 'story', 'community_post'));

-- Ensure community_id column exists on posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);

-- Backfill: any post with video_url but no valid post_type → classify correctly
UPDATE posts SET post_type = 'post' WHERE post_type IS NULL;
