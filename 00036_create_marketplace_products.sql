
-- Tabela principal de produtos do marketplace
CREATE TABLE IF NOT EXISTS marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AOA',
  category TEXT NOT NULL DEFAULT 'geral',
  images TEXT[] DEFAULT '{}',
  contact_whatsapp TEXT,
  contact_email TEXT,
  location TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS marketplace_products_user_id_idx ON marketplace_products(user_id);
CREATE INDEX IF NOT EXISTS marketplace_products_category_idx ON marketplace_products(category);
CREATE INDEX IF NOT EXISTS marketplace_products_created_at_idx ON marketplace_products(created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_products_available_idx ON marketplace_products(is_available) WHERE is_available = true;

-- RLS
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;

-- Leitura pública
CREATE POLICY "marketplace_products_select_public"
  ON marketplace_products FOR SELECT
  USING (is_available = true);

-- Owner pode ver os seus produtos (inclusive indisponíveis)
CREATE POLICY "marketplace_products_select_own"
  ON marketplace_products FOR SELECT
  USING (auth.uid() = user_id);

-- Criar produto (autenticado)
CREATE POLICY "marketplace_products_insert"
  ON marketplace_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Actualizar/apagar os seus produtos
CREATE POLICY "marketplace_products_update"
  ON marketplace_products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "marketplace_products_delete"
  ON marketplace_products FOR DELETE
  USING (auth.uid() = user_id);
