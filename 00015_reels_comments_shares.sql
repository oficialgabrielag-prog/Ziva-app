
-- Tabela de comentários de reels
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  audio_url text DEFAULT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert" ON public.reel_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reel_comments_delete" ON public.reel_comments FOR DELETE USING (user_id = auth.uid());

-- Tabela de partilhas de reels
CREATE TABLE IF NOT EXISTS public.reel_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type text NOT NULL DEFAULT 'chat', -- 'chat' | 'feed'
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reel_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reel_shares_select" ON public.reel_shares FOR SELECT USING (true);
CREATE POLICY "reel_shares_insert" ON public.reel_shares FOR INSERT WITH CHECK (user_id = auth.uid());

-- Adicionar colunas em falta
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0;

-- Função incrementar shares
CREATE OR REPLACE FUNCTION increment_reel_shares(reel_id_arg uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE reels SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = reel_id_arg;
$$;

-- Adicionar coluna audio_url à tabela comments (se não existir)
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS audio_url text DEFAULT NULL;

-- Adicionar campo profiles ao select de reel_comments (join via VIEW)
CREATE OR REPLACE VIEW public.reel_comments_with_profiles AS
  SELECT rc.*, p.username, p.avatar_url, p.full_name
  FROM public.reel_comments rc
  LEFT JOIN public.profiles p ON p.id = rc.user_id;
