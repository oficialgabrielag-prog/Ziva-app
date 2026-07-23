-- Adicionar campo para a chave API Gemini pessoal do utilizador
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT DEFAULT '';