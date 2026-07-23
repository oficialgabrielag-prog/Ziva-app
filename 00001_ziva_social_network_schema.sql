
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  followers_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Posts table
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  caption text NOT NULL DEFAULT '',
  image_url text DEFAULT '',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stories table (expires after 24h)
CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  media_url text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Follows table
CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- Likes table
CREATE TABLE likes (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- Comments table
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('follow', 'like', 'comment')),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Conversations table
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_one uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_two uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message text DEFAULT '',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_one, participant_two)
);

-- Messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Storage bucket for Ziva images
INSERT INTO storage.buckets (id, name, public)
VALUES ('ziva_images', 'ziva_images', true)
ON CONFLICT (id) DO NOTHING;

-- FUNCTIONS

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update followers/following counts on follow
CREATE OR REPLACE FUNCTION handle_follow_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  -- Create notification
  INSERT INTO notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follow_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION handle_follow_insert();

CREATE OR REPLACE FUNCTION handle_follow_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_follow_delete
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION handle_follow_delete();

-- Update posts_count on insert/delete
CREATE OR REPLACE FUNCTION handle_post_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET posts_count = posts_count + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_post_insert
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION handle_post_insert();

CREATE OR REPLACE FUNCTION handle_post_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET posts_count = GREATEST(0, posts_count - 1) WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_post_delete
  AFTER DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION handle_post_delete();

-- Update likes count
CREATE OR REPLACE FUNCTION handle_like_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  SELECT user_id INTO v_post_owner FROM posts WHERE id = NEW.post_id;
  IF v_post_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION handle_like_insert();

CREATE OR REPLACE FUNCTION handle_like_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_like_delete
  AFTER DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION handle_like_delete();

-- Update comments count
CREATE OR REPLACE FUNCTION handle_comment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  SELECT user_id INTO v_post_owner FROM posts WHERE id = NEW.post_id;
  IF v_post_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'comment', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_insert
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION handle_comment_insert();

CREATE OR REPLACE FUNCTION handle_comment_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_comment_delete
  AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION handle_comment_delete();

-- RLS POLICIES

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (id = auth.uid());

-- Posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_all" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON posts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts_update_own" ON posts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "posts_delete_own" ON posts FOR DELETE USING (user_id = auth.uid());

-- Stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_select_all" ON stories FOR SELECT USING (expires_at > now());
CREATE POLICY "stories_insert_own" ON stories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "stories_delete_own" ON stories FOR DELETE USING (user_id = auth.uid());

-- Follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select_all" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete_own" ON follows FOR DELETE USING (follower_id = auth.uid());

-- Likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select_all" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes_delete_own" ON likes FOR DELETE USING (user_id = auth.uid());

-- Comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (user_id = auth.uid());

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE USING (user_id = auth.uid());

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_select_participant" ON conversations FOR SELECT USING (participant_one = auth.uid() OR participant_two = auth.uid());
CREATE POLICY "conversations_insert_auth" ON conversations FOR INSERT WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());
CREATE POLICY "conversations_update_participant" ON conversations FOR UPDATE USING (participant_one = auth.uid() OR participant_two = auth.uid());

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_participant" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update_own" ON messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

-- Storage policies for ziva_images
CREATE POLICY "ziva_images_select_all" ON storage.objects FOR SELECT USING (bucket_id = 'ziva_images');
CREATE POLICY "ziva_images_insert_auth" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ziva_images' AND auth.uid() IS NOT NULL);
CREATE POLICY "ziva_images_update_own" ON storage.objects FOR UPDATE USING (bucket_id = 'ziva_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "ziva_images_delete_own" ON storage.objects FOR DELETE USING (bucket_id = 'ziva_images' AND auth.uid()::text = (storage.foldername(name))[1]);
