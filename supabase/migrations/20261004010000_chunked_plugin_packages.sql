-- Run in the Supabase SQL Editor before publishing software plugins.
-- Supports complete ZIP packages stored as private 32 MiB parts.
-- This migration includes the original single-file setup and is idempotent.
-- Existing assets/materials setup and policies remain unchanged.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plugin-packages',
  'plugin-packages',
  false,
  52428800,
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Let the website administrator check the private bucket configuration before
-- selecting or uploading a package. Object access remains controlled below.
DROP POLICY IF EXISTS fesilent_plugin_bucket_select ON storage.buckets;
CREATE POLICY fesilent_plugin_bucket_select ON storage.buckets
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    id = 'plugin-packages'
    AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
  );

-- Only legacy UUID/package.zip or UUID/part-00[0-6].bin objects are allowed.
-- Up to seven 32 MiB parts hold a maximum 200 MiB package.
-- Exact length and case-sensitive suffixes exclude trailing newlines or folders.
DROP POLICY IF EXISTS fesilent_plugin_select ON storage.objects;
CREATE POLICY fesilent_plugin_select ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'plugin-packages'
    AND (
      (length(name) = 48 AND right(name, 12) = '/package.zip'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$')
      OR (length(name) = 49 AND right(name, 13) ~ '^/part-00[0-6]\.bin$'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/part-00[0-6]\.bin$')
    )
  );

DROP POLICY IF EXISTS fesilent_plugin_insert ON storage.objects;
CREATE POLICY fesilent_plugin_insert ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plugin-packages'
    AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
    AND (
      (length(name) = 48 AND right(name, 12) = '/package.zip'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$')
      OR (length(name) = 49 AND right(name, 13) ~ '^/part-00[0-6]\.bin$'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/part-00[0-6]\.bin$')
    )
  );

DROP POLICY IF EXISTS fesilent_plugin_delete ON storage.objects;
CREATE POLICY fesilent_plugin_delete ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'plugin-packages'
    AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'
    AND (
      (length(name) = 48 AND right(name, 12) = '/package.zip'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$')
      OR (length(name) = 49 AND right(name, 13) ~ '^/part-00[0-6]\.bin$'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/part-00[0-6]\.bin$')
    )
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
      AND (
        (length(name) = 48 AND right(name, 12) = '/package.zip'
          AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$')
        OR (length(name) = 49 AND right(name, 13) ~ '^/part-00[0-6]\.bin$'
          AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/part-00[0-6]\.bin$')
      )
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
      AND (
        (length(name) = 48 AND right(name, 12) = '/package.zip'
          AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$')
        OR (length(name) = 49 AND right(name, 13) ~ '^/part-00[0-6]\.bin$'
          AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/part-00[0-6]\.bin$')
      )
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
      AND (
        (length(name) = 48 AND right(name, 12) = '/package.zip'
          AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/package\.zip$')
        OR (length(name) = 49 AND right(name, 13) ~ '^/part-00[0-6]\.bin$'
          AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/part-00[0-6]\.bin$')
      )
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
