-- Run in the Supabase SQL Editor before publishing software plugins.
-- Existing assets/materials setup and policies remain unchanged.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plugin-packages',
  'plugin-packages',
  false,
  52428800,
  ARRAY['application/zip', 'application/x-zip-compressed']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- UUID/package.zip is the complete object name, with no nested paths or suffixes.
-- Length and the case-sensitive suffix also exclude trailing newlines and .ZIP.
DROP POLICY IF EXISTS fesilent_plugin_select ON storage.objects;
CREATE POLICY fesilent_plugin_select ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'plugin-packages'
    AND length(name) = 48
    AND right(name, 12) = '/package.zip'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$'
  );

DROP POLICY IF EXISTS fesilent_plugin_insert ON storage.objects;
CREATE POLICY fesilent_plugin_insert ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plugin-packages'
    AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
    AND length(name) = 48
    AND right(name, 12) = '/package.zip'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$'
  );

DROP POLICY IF EXISTS fesilent_plugin_delete ON storage.objects;
CREATE POLICY fesilent_plugin_delete ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'plugin-packages'
    AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
    AND length(name) = 48
    AND right(name, 12) = '/package.zip'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$'
  );

-- Restrictive guards apply even when a pre-existing permissive policy uses true.
-- For all other buckets these guards are true, leaving their policies in effect.
DROP POLICY IF EXISTS fesilent_plugin_select_guard ON storage.objects;
CREATE POLICY fesilent_plugin_select_guard ON storage.objects
  AS RESTRICTIVE FOR SELECT TO public
  USING (
    bucket_id <> 'plugin-packages'
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND (SELECT auth.role()) = 'authenticated'
      AND length(name) = 48
      AND right(name, 12) = '/package.zip'
      AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$'
    )
  );

DROP POLICY IF EXISTS fesilent_plugin_insert_guard ON storage.objects;
CREATE POLICY fesilent_plugin_insert_guard ON storage.objects
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (
    bucket_id <> 'plugin-packages'
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND (SELECT auth.role()) = 'authenticated'
      AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
      AND length(name) = 48
      AND right(name, 12) = '/package.zip'
      AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$'
    )
  );

DROP POLICY IF EXISTS fesilent_plugin_delete_guard ON storage.objects;
CREATE POLICY fesilent_plugin_delete_guard ON storage.objects
  AS RESTRICTIVE FOR DELETE TO public
  USING (
    bucket_id <> 'plugin-packages'
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND (SELECT auth.role()) = 'authenticated'
      AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
      AND length(name) = 48
      AND right(name, 12) = '/package.zip'
      AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$'
    )
  );

-- Package uploads use new UUIDs and upsert:false. Overwrites, renames and moves
-- involving this bucket are forbidden, including under old UPDATE policies.
DROP POLICY IF EXISTS fesilent_plugin_update_guard ON storage.objects;
CREATE POLICY fesilent_plugin_update_guard ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO public
  USING (bucket_id <> 'plugin-packages')
  WITH CHECK (bucket_id <> 'plugin-packages');

COMMIT;
