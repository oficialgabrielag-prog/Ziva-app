
-- Tabela cache para dados do Pulso Angola (clima, combustível)
CREATE TABLE IF NOT EXISTS pulso_cache (
  cache_key   TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  cached_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de factos/memória persistente da Aura por utilizador
CREATE TABLE IF NOT EXISTS aura_user_facts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_key    TEXT NOT NULL,          -- ex: "nome_preferido", "provincia", "profissao"
  fact_value  TEXT NOT NULL,
  confidence  FLOAT DEFAULT 1.0,     -- 0.0-1.0, diminui com tempo
  source      TEXT DEFAULT 'conversa', -- 'conversa' | 'perfil' | 'manual'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fact_key)
);

-- Índice para lookup rápido por utilizador
CREATE INDEX IF NOT EXISTS idx_aura_facts_user ON aura_user_facts(user_id);

-- RLS: utilizador só vê os seus próprios factos
ALTER TABLE aura_user_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facts_own" ON aura_user_facts
  FOR ALL USING (auth.uid() = user_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_aura_facts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE OR REPLACE TRIGGER trg_aura_facts_updated_at
  BEFORE UPDATE ON aura_user_facts
  FOR EACH ROW EXECUTE FUNCTION update_aura_facts_updated_at();

-- pulso_cache sem RLS (dados públicos de Angola)
ALTER TABLE pulso_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pulso_public_read" ON pulso_cache FOR SELECT USING (true);
CREATE POLICY "pulso_service_write" ON pulso_cache FOR ALL USING (true);
