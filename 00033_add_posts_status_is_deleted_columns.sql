
-- Adicionar colunas status e is_deleted que faltam na tabela posts
-- DEFAULT garante que todas as linhas existentes ficam correctamente definidas
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Re-sincronizar posts_count nos perfis com base nas publicações reais
UPDATE profiles p
SET posts_count = (
  SELECT COUNT(*)
  FROM posts
  WHERE user_id = p.id
    AND status = 'published'
    AND is_deleted = false
);
