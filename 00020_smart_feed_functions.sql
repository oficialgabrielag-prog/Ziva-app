
-- Hashtags em tendência dos últimos 7 dias
CREATE OR REPLACE FUNCTION get_trending_hashtags(lim int DEFAULT 12)
RETURNS TABLE(tag text, post_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    lower(m[1]) AS tag,
    count(*) AS post_count
  FROM posts,
    regexp_matches(caption, '#([A-Za-z\u00C0-\u00FF0-9_]+)', 'g') AS m
  WHERE created_at > now() - interval '7 days'
  GROUP BY lower(m[1])
  ORDER BY post_count DESC
  LIMIT lim;
$$;

-- Contagem de não lidos (notificações + mensagens)
CREATE OR REPLACE FUNCTION get_unread_counts(uid uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'notifications',
    (SELECT count(*) FROM notifications WHERE user_id = uid AND is_read = false),
    'messages',
    (SELECT count(*) FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.participant_one = uid OR c.participant_two = uid)
        AND m.sender_id != uid
        AND m.is_read = false)
  );
$$;
