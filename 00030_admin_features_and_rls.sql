-- Coluna is_admin nos perfis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Marcar Gabriel como admin
UPDATE profiles
SET is_admin = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'officialantoniogabriel@gmail.com'
);

-- Função: estatísticas globais (só admins)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE(
  total_users BIGINT, active_today BIGINT,
  total_posts BIGINT, total_reels BIGINT,
  total_comments BIGINT, total_likes BIGINT,
  total_communities BIGINT, new_users_week BIGINT,
  new_posts_today BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM profiles)::BIGINT,
    (SELECT COUNT(*) FROM profiles WHERE last_seen_at > NOW() - INTERVAL '1 day')::BIGINT,
    (SELECT COUNT(*) FROM posts WHERE post_type = 'post')::BIGINT,
    (SELECT COUNT(*) FROM posts WHERE post_type = 'reel')::BIGINT,
    (SELECT COUNT(*) FROM comments)::BIGINT,
    (SELECT COUNT(*) FROM likes)::BIGINT,
    (SELECT COUNT(*) FROM communities)::BIGINT,
    (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*) FROM posts WHERE created_at > NOW() - INTERVAL '1 day')::BIGINT;
END;
$$;

-- Função: lista todos os utilizadores com pesquisa (só admins)
CREATE OR REPLACE FUNCTION get_all_users(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT ''
)
RETURNS TABLE(
  id UUID, username TEXT, full_name TEXT, email TEXT,
  avatar_url TEXT, created_at TIMESTAMPTZ,
  followers_count INT, posts_count INT,
  is_verified BOOLEAN, is_admin BOOLEAN, last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
    SELECT
      p.id, p.username, p.full_name,
      COALESCE(u.email, '')::TEXT,
      p.avatar_url, p.created_at,
      COALESCE(p.followers_count, 0), COALESCE(p.posts_count, 0),
      COALESCE(p.is_verified, FALSE), COALESCE(p.is_admin, FALSE),
      p.last_seen_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p_search = ''
      OR p.username ILIKE '%' || p_search || '%'
      OR p.full_name ILIKE '%' || p_search || '%'
      OR u.email ILIKE '%' || p_search || '%'
    ORDER BY p.followers_count DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Função: alternar verificação de utilizador (só admins)
CREATE OR REPLACE FUNCTION admin_toggle_verified(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_val BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE profiles SET is_verified = NOT COALESCE(is_verified, FALSE)
  WHERE id = target_user_id
  RETURNING is_verified INTO new_val;
  RETURN new_val;
END;
$$;