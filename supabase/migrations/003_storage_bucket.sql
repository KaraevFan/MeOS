-- Create private storage bucket for user markdown files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-files', 'user-files', false, 1048576, ARRAY['text/markdown', 'text/plain']);

-- RLS: Users can only access their own folder
-- All policies include path traversal protection (NOT LIKE '%..%')

CREATE POLICY "users_own_folder_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = (auth.jwt()->>'sub')
    AND name NOT LIKE '%..%'
  );

CREATE POLICY "users_own_folder_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = (auth.jwt()->>'sub')
    AND name NOT LIKE '%..%'
  );

CREATE POLICY "users_own_folder_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = (auth.jwt()->>'sub')
    AND name NOT LIKE '%..%'
  )
  WITH CHECK (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = (auth.jwt()->>'sub')
    AND name NOT LIKE '%..%'
  );

CREATE POLICY "users_own_folder_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = (auth.jwt()->>'sub')
    AND name NOT LIKE '%..%'
  );
