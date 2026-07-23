
-- Cover photo for profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- image_urls array for carousel posts & views counter
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- comment audio + pinning
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- message media + read receipts
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT;

-- story highlights
CREATE TABLE IF NOT EXISTS story_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_highlight_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID REFERENCES story_highlights(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE story_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Highlights public read" ON story_highlights FOR SELECT USING (true);
CREATE POLICY "Highlights owner write" ON story_highlights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Highlight items public read" ON story_highlight_items FOR SELECT USING (true);
CREATE POLICY "Highlight items owner write" ON story_highlight_items FOR ALL
  USING (EXISTS (SELECT 1 FROM story_highlights sh WHERE sh.id = highlight_id AND sh.user_id = auth.uid()));
