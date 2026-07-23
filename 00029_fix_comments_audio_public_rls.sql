-- Garantir que o bucket ziva_images é público (para áudios de comentários)
UPDATE storage.buckets SET public = TRUE WHERE id = 'ziva_images';

-- Política de leitura pública para áudios em comments-audio/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'ziva_images_comments_audio_public_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "ziva_images_comments_audio_public_read"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'ziva_images' AND (name LIKE 'comments-audio/%' OR name LIKE 'posts/%' OR name LIKE 'avatars/%' OR name LIKE 'covers/%'));
    $pol$;
  END IF;
END $$;

-- Política de inserção autenticada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'ziva_images_auth_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "ziva_images_auth_insert"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'ziva_images' AND auth.uid() IS NOT NULL);
    $pol$;
  END IF;
END $$;