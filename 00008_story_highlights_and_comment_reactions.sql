
-- Story highlights already exist from previous migration, ensure columns
ALTER TABLE story_highlights ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '';

-- Comment reactions table
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage comment likes" ON comment_likes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Comment likes visible to all" ON comment_likes FOR SELECT USING (true);

-- Add likes_count to comments if missing
ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- RPC to increment/decrement comment likes
CREATE OR REPLACE FUNCTION increment_comment_likes(comment_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE comments SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = comment_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_comment_likes(comment_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE comments SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = comment_id_arg;
$$;
