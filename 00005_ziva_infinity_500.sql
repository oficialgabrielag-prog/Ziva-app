
-- ─── Reactions (9 tipos) ──────────────────────────────────────────────────────
ALTER TABLE likes ADD COLUMN IF NOT EXISTS reaction_type text NOT NULL DEFAULT 'love';

-- ─── Story Views ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)
);
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='story_views' AND policyname='story_views_all') THEN
    CREATE POLICY "story_views_all" ON story_views USING (true) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Saved Posts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_posts' AND policyname='saved_posts_all') THEN
    CREATE POLICY "saved_posts_all" ON saved_posts USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Comment threading + likes ────────────────────────────────────────────────
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comment_likes' AND policyname='comment_likes_all') THEN
    CREATE POLICY "comment_likes_all" ON comment_likes USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Notifications improvements ───────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'like';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reel_id uuid REFERENCES reels(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message text;

-- ─── Ziva IA Memory ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ziva_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  mode text NOT NULL DEFAULT 'chat',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ziva_conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ziva_conversations' AND policyname='ziva_conv_user') THEN
    CREATE POLICY "ziva_conv_user" ON ziva_conversations USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── User Settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'light',
  language text NOT NULL DEFAULT 'pt-AO',
  notifications_likes boolean NOT NULL DEFAULT true,
  notifications_comments boolean NOT NULL DEFAULT true,
  notifications_follows boolean NOT NULL DEFAULT true,
  notifications_mentions boolean NOT NULL DEFAULT true,
  profile_public boolean NOT NULL DEFAULT true,
  ziva_personality text NOT NULL DEFAULT 'amigavel',
  ziva_memory boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_settings' AND policyname='user_settings_own') THEN
    CREATE POLICY "user_settings_own" ON user_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE posts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE likes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
