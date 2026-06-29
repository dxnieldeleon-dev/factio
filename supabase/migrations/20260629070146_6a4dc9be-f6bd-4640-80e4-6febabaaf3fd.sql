
CREATE POLICY "Users can upload their own CSD files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'csd-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own CSD files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'csd-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own CSD files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'csd-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own CSD files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'csd-files' AND (storage.foldername(name))[1] = auth.uid()::text);
