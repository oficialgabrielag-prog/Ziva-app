
-- ── 1. Melhorias na tabela messages ──────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','image','voice','sticker','system')),
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── 2. Unread count na tabela conversations ───────────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS unread_one INT NOT NULL DEFAULT 0,  -- não lidas para participant_one
  ADD COLUMN IF NOT EXISTS unread_two INT NOT NULL DEFAULT 0;  -- não lidas para participant_two

-- ── 3. Reações a mensagens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  emoji           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select_all"   ON message_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_own"   ON message_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_delete_own"   ON message_reactions FOR DELETE USING (user_id = auth.uid());

-- ── 4. Índices de performance ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON message_reactions(message_id);

-- ── 5. Trigger: atualizar last_message + unread_count ao inserir mensagem ─────
CREATE OR REPLACE FUNCTION fn_message_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE conversations SET
    last_message    = CASE WHEN NEW.message_type = 'text' THEN NEW.content ELSE '📎 ' || NEW.message_type END,
    last_message_at = NEW.created_at,
    -- incrementa unread do destinatário
    unread_one = CASE
      WHEN participant_two = NEW.sender_id THEN unread_one + 1
      ELSE unread_one
    END,
    unread_two = CASE
      WHEN participant_one = NEW.sender_id THEN unread_two + 1
      ELSE unread_two
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_after_insert ON messages;
CREATE TRIGGER trg_message_after_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION fn_message_after_insert();

-- ── 6. Função RPC: obter ou criar conversa entre dois utilizadores ─────────────
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv_id UUID;
  v_me UUID := auth.uid();
BEGIN
  IF v_me = other_user_id THEN
    RAISE EXCEPTION 'Não podes iniciar uma conversa contigo mesmo';
  END IF;

  -- Tentar encontrar conversa existente (qualquer ordem dos participantes)
  SELECT id INTO v_conv_id FROM conversations
  WHERE (participant_one = v_me AND participant_two = other_user_id)
     OR (participant_one = other_user_id AND participant_two = v_me)
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (participant_one, participant_two)
    VALUES (v_me, other_user_id)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- ── 7. Função RPC: marcar mensagens como lidas + zerar unread ─────────────────
CREATE OR REPLACE FUNCTION mark_conversation_read(conv_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  -- Marcar mensagens não lidas como lidas
  UPDATE messages
  SET is_read = true, read_at = NOW()
  WHERE conversation_id = conv_id
    AND sender_id <> v_me
    AND is_read = false;

  -- Zerar contador de não lidas para o utilizador actual
  UPDATE conversations SET
    unread_one = CASE WHEN participant_one = v_me THEN 0 ELSE unread_one END,
    unread_two = CASE WHEN participant_two = v_me THEN 0 ELSE unread_two END
  WHERE id = conv_id;
END;
$$;

-- ── 8. Função RPC: apagar mensagem (soft delete) ──────────────────────────────
CREATE OR REPLACE FUNCTION delete_message(msg_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE messages SET deleted_at = NOW(), content = ''
  WHERE id = msg_id AND sender_id = auth.uid() AND deleted_at IS NULL;
END;
$$;

-- ── 9. Função RPC: adicionar/remover reação ────────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_message_reaction(msg_id UUID, reaction_emoji TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM message_reactions
    WHERE message_id = msg_id AND user_id = auth.uid() AND emoji = reaction_emoji
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM message_reactions WHERE message_id = msg_id AND user_id = auth.uid() AND emoji = reaction_emoji;
    RETURN false;
  ELSE
    INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (msg_id, auth.uid(), reaction_emoji);
    RETURN true;
  END IF;
END;
$$;
