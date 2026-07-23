
-- 1. Garantir coluna is_verified existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- 2. Marcar todos os utilizadores existentes como verificados
UPDATE profiles SET is_verified = true WHERE is_verified = false;

-- 3. Trigger: todos os novos utilizadores ficam verificados automaticamente
CREATE OR REPLACE FUNCTION public.auto_verify_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.is_verified := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_verify ON profiles;
CREATE TRIGGER trg_auto_verify
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_new_user();
