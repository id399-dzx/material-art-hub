-- Signed URLs are issued only for an active package, except for admin staging.
BEGIN;
DROP POLICY IF EXISTS fesilent_plugin_published_guard ON storage.objects;
CREATE POLICY fesilent_plugin_published_guard ON storage.objects
AS RESTRICTIVE FOR SELECT TO public
USING (
  bucket_id <> 'plugin-packages'
  OR (
    (SELECT auth.role()) = 'authenticated'
    AND (
      (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.assets AS asset
        WHERE NOT asset.hidden
          AND asset.tags_style @> ARRAY['__fesilent_software_plugin_v1__']::text[]
          AND asset.source_file_url = 'storage://plugin-packages/'
            || split_part(storage.objects.name, '/', 1)
            || CASE WHEN right(storage.objects.name, 12) = '/package.zip'
              THEN '/package.zip' ELSE '/package.parts' END
      )
    )
  )
);
COMMIT;
