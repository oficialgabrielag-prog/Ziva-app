
-- Campos extras no perfil
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location       TEXT,
  ADD COLUMN IF NOT EXISTS birth_date     DATE,
  ADD COLUMN IF NOT EXISTS website        TEXT,
  ADD COLUMN IF NOT EXISTS mood_status    TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at   TIMESTAMPTZ DEFAULT now();

-- Atualizar last_seen_at automaticamente via trigger
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.last_seen_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_last_seen ON profiles;
CREATE TRIGGER trg_touch_last_seen
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_last_seen();

-- Destaques (Story Highlights)
CREATE TABLE IF NOT EXISTS story_highlights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Destaque',
  cover_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_highlights_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES story_highlights(id) ON DELETE CASCADE,
  story_id     UUID REFERENCES stories(id) ON DELETE SET NULL,
  media_url    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE story_highlights       ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_highlights_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "highlights_select" ON story_highlights;
DROP POLICY IF EXISTS "highlights_insert" ON story_highlights;
DROP POLICY IF EXISTS "highlights_delete" ON story_highlights;
DROP POLICY IF EXISTS "highlights_items_select" ON story_highlights_items;
DROP POLICY IF EXISTS "highlights_items_insert" ON story_highlights_items;
DROP POLICY IF EXISTS "highlights_items_delete" ON story_highlights_items;

CREATE POLICY "highlights_select" ON story_highlights FOR SELECT USING (true);
CREATE POLICY "highlights_insert" ON story_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "highlights_delete" ON story_highlights FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "highlights_items_select" ON story_highlights_items FOR SELECT USING (true);
CREATE POLICY "highlights_items_insert" ON story_highlights_items FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM story_highlights WHERE id = highlight_id));
CREATE POLICY "highlights_items_delete" ON story_highlights_items FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM story_highlights WHERE id = highlight_id));
