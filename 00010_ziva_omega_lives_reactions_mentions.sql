
-- ─── Lives ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lives (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','live','ended')),
  viewer_count INT  NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  replay_url   TEXT,
  thumbnail_url TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lives_select_all"  ON lives FOR SELECT USING (true);
CREATE POLICY "lives_insert_host" ON lives FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "lives_update_host" ON lives FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "lives_delete_host" ON lives FOR DELETE USING (host_id = auth.uid());

-- Live chat messages
CREATE TABLE IF NOT EXISTS live_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id    UUID NOT NULL REFERENCES lives(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE live_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_messages_select_all"   ON live_messages FOR SELECT USING (true);
CREATE POLICY "live_messages_insert_auth"  ON live_messages FOR INSERT WITH CHECK (user_id = auth.uid());

-- Live reactions (emoji bursts)
CREATE TABLE IF NOT EXISTS live_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id    UUID NOT NULL REFERENCES lives(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE live_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_reactions_select_all"  ON live_reactions FOR SELECT USING (true);
CREATE POLICY "live_reactions_insert_auth" ON live_reactions FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── Post Reactions (9 tipos) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_reactions_select_all"    ON post_reactions FOR SELECT USING (true);
CREATE POLICY "post_reactions_insert_auth"   ON post_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "post_reactions_update_auth"   ON post_reactions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "post_reactions_delete_auth"   ON post_reactions FOR DELETE USING (user_id = auth.uid());

-- ─── Mentions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentioner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentions_select_all"   ON mentions FOR SELECT USING (true);
CREATE POLICY "mentions_insert_auth"  ON mentions FOR INSERT WITH CHECK (mentioner_id = auth.uid());

-- ─── RPC: increment/decrement live viewers ───────────────────────────────────
CREATE OR REPLACE FUNCTION increment_live_viewers(live_id_arg UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE lives SET viewer_count = viewer_count + 1 WHERE id = live_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_live_viewers(live_id_arg UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE lives SET viewer_count = GREATEST(0, viewer_count - 1) WHERE id = live_id_arg;
$$;

-- ─── Notifications: add live type support ────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS live_id UUID REFERENCES lives(id) ON DELETE SET NULL;

-- ─── Posts: add video_url for video posts ────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'post' CHECK (post_type IN ('post','reel','story'));
