
-- Fix search_path on all SECURITY DEFINER trigger functions
CREATE OR REPLACE FUNCTION public.handle_post_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET posts_count = posts_count + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_post_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET posts_count = GREATEST(0, posts_count - 1) WHERE id = OLD.user_id;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_like_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post_owner uuid;
BEGIN
  UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  SELECT user_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  IF v_post_owner IS NOT NULL AND v_post_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_like_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_comment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post_owner uuid;
BEGIN
  UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  SELECT user_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  IF v_post_owner IS NOT NULL AND v_post_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'comment', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_comment_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_follow_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_follow_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
  RETURN OLD;
END; $$;

-- Reels table
CREATE TABLE IF NOT EXISTS public.reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text DEFAULT '',
  caption text DEFAULT '',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reel likes table
CREATE TABLE IF NOT EXISTS public.reel_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, reel_id)
);

-- Enable RLS
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for reels
CREATE POLICY "reels_select_all" ON public.reels FOR SELECT USING (true);
CREATE POLICY "reels_insert_own" ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

-- RLS policies for reel_likes
CREATE POLICY "reel_likes_select_all" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert_own" ON public.reel_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reel_likes_delete_own" ON public.reel_likes FOR DELETE USING (user_id = auth.uid());

-- Triggers for reel like counts
CREATE OR REPLACE FUNCTION public.handle_reel_like_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reels SET likes_count = likes_count + 1 WHERE id = NEW.reel_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_reel_like_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.reel_id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS on_reel_like_insert ON public.reel_likes;
CREATE TRIGGER on_reel_like_insert AFTER INSERT ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_reel_like_insert();

DROP TRIGGER IF EXISTS on_reel_like_delete ON public.reel_likes;
CREATE TRIGGER on_reel_like_delete AFTER DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_reel_like_delete();
