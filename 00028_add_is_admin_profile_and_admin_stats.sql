
-- Adicionar coluna is_admin aos perfis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Definir admin para a conta do Gabriel
UPDATE profiles
SET is_admin = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'officialantoniogabriel@gmail.com'
);

-- Função RPC segura: apenas admins podem ver estatísticas globais da plataforma
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE(
  total_users     BIGINT,
  active_today    BIGINT,
  total_posts     BIGINT,
  total_reels     BIGINT,
  total_comments  BIGINT,
  total_likes     BIGINT,
  total_communities BIGINT,
  new_users_week  BIGINT,
  new_posts_today BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o chamador é admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;

  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM profiles)::BIGINT AS total_users,
    (SELECT COUNT(*) FROM profiles WHERE last_seen_at > NOW() - INTERVAL '24 hours')::BIGINT AS active_today,
    (SELECT COUNT(*) FROM posts)::BIGINT AS total_posts,
    (SELECT COUNT(*) FROM reels)::BIGINT AS total_reels,
    (SELECT COUNT(*) FROM comments)::BIGINT AS total_comments,
    (SELECT COUNT(*) FROM likes)::BIGINT AS total_likes,
    (SELECT COUNT(*) FROM communities)::BIGINT AS total_communities,
    (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT AS new_users_week,
    (SELECT COUNT(*) FROM posts WHERE created_at > NOW() - INTERVAL '24 hours')::BIGINT AS new_posts_today;
END;
$$;

-- Função para listar todos os utilizadores (apenas admins)
CREATE OR REPLACE FUNCTION get_all_users(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0, p_search TEXT DEFAULT '')
RETURNS TABLE(
  id UUID, username TEXT, full_name TEXT, email TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ, followers_count INT, posts_count INT,
  is_verified BOOLEAN, is_admin BOOLEAN, last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.username, p.full_name,
    u.email::TEXT,
    p.avatar_url, p.created_at,
    p.followers_count, p.posts_count,
    p.is_verified, p.is_admin, p.last_seen_at
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE (p_search = '' OR p.username ILIKE '%' || p_search || '%' OR p.full_name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Função para toggle verificação (apenas admins)
CREATE OR REPLACE FUNCTION admin_toggle_verified(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_val BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE profiles SET is_verified = NOT is_verified WHERE id = target_user_id RETURNING is_verified INTO new_val;
  RETURN new_val;
END;
$$;
