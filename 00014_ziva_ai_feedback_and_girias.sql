
-- Tabela de feedback nas respostas da Ziva IA
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de gírias/expressões angolanas submetidas pelos utilizadores
CREATE TABLE IF NOT EXISTS angola_girias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  expression TEXT NOT NULL,
  meaning TEXT NOT NULL,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache de tendências (notícias Angola) para evitar chamadas repetidas
CREATE TABLE IF NOT EXISTS trending_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE angola_girias ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilizadores inserem o seu feedback" ON ai_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Utilizadores veem o seu feedback" ON ai_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Utilizadores inserem gírias" ON angola_girias
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gírias aprovadas são públicas" ON angola_girias
  FOR SELECT USING (approved = TRUE OR auth.uid() = user_id);

CREATE POLICY "Trending é público" ON trending_cache
  FOR ALL USING (TRUE);
