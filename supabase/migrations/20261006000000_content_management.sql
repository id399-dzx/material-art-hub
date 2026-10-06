-- Shared catalog overrides and recoverable removal of published content.
-- Existing files and package references are preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS public.site_content (
  section text NOT NULL CHECK (section IN ('skills', 'journals', 'templates')),
  item_id text NOT NULL CHECK (length(item_id) BETWEEN 1 AND 200),
  patch jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(patch) = 'object'),
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (section, item_id)
);

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

CREATE OR REPLACE FUNCTION public.fesilent_content_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fesilent_content_timestamp ON public.site_content;
CREATE TRIGGER fesilent_content_timestamp BEFORE UPDATE ON public.site_content
FOR EACH ROW EXECUTE FUNCTION public.fesilent_content_timestamp();
DROP TRIGGER IF EXISTS fesilent_asset_timestamp ON public.assets;
CREATE TRIGGER fesilent_asset_timestamp BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.fesilent_content_timestamp();

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
DROP POLICY IF EXISTS fesilent_content_read ON public.site_content;
CREATE POLICY fesilent_content_read ON public.site_content FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS fesilent_content_admin ON public.site_content;
CREATE POLICY fesilent_content_admin ON public.site_content FOR ALL TO authenticated
USING ((SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com')
WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
-- Restrictive guards also protect installations with older broad write policies.
DROP POLICY IF EXISTS fesilent_content_insert_guard ON public.site_content;
CREATE POLICY fesilent_content_insert_guard ON public.site_content AS RESTRICTIVE FOR INSERT TO public
WITH CHECK ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_content_update_guard ON public.site_content;
CREATE POLICY fesilent_content_update_guard ON public.site_content AS RESTRICTIVE FOR UPDATE TO public
USING ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com')
WITH CHECK ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_content_delete_guard ON public.site_content;
CREATE POLICY fesilent_content_delete_guard ON public.site_content AS RESTRICTIVE FOR DELETE TO public
USING ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assets TO authenticated;
DROP POLICY IF EXISTS fesilent_assets_read ON public.assets;
CREATE POLICY fesilent_assets_read ON public.assets FOR SELECT TO anon, authenticated
USING (NOT hidden OR (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_assets_read_guard ON public.assets;
CREATE POLICY fesilent_assets_read_guard ON public.assets AS RESTRICTIVE FOR SELECT TO public
USING (NOT hidden OR ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'));
DROP POLICY IF EXISTS fesilent_assets_admin ON public.assets;
CREATE POLICY fesilent_assets_admin ON public.assets FOR ALL TO authenticated
USING ((SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com')
WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_assets_insert_guard ON public.assets;
CREATE POLICY fesilent_assets_insert_guard ON public.assets AS RESTRICTIVE FOR INSERT TO public
WITH CHECK ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_assets_update_guard ON public.assets;
CREATE POLICY fesilent_assets_update_guard ON public.assets AS RESTRICTIVE FOR UPDATE TO public
USING ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com')
WITH CHECK ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_assets_delete_guard ON public.assets;
CREATE POLICY fesilent_assets_delete_guard ON public.assets AS RESTRICTIVE FOR DELETE TO public
USING ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');

-- Compare and write in one SQL statement. No client-side read/upsert race.
CREATE OR REPLACE FUNCTION public.manage_site_content(
  p_section text, p_item_id text, p_patch jsonb, p_hidden boolean,
  p_expected timestamptz, p_reset boolean DEFAULT false
) RETURNS SETOF public.site_content LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'authenticated'
    OR (SELECT auth.jwt() ->> 'email') IS DISTINCT FROM 'id19991016@gmail.com' THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501';
  END IF;
  IF p_reset THEN
    RETURN QUERY DELETE FROM public.site_content
      WHERE section = p_section AND item_id = p_item_id AND updated_at = p_expected RETURNING *;
  ELSIF p_expected IS NULL THEN
    RETURN QUERY INSERT INTO public.site_content (section, item_id, patch, hidden)
      VALUES (p_section, p_item_id, p_patch, p_hidden)
      ON CONFLICT (section, item_id) DO NOTHING RETURNING *;
  ELSE
    RETURN QUERY UPDATE public.site_content SET patch = p_patch, hidden = p_hidden
      WHERE section = p_section AND item_id = p_item_id AND updated_at = p_expected RETURNING *;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_site_content(text,text,jsonb,boolean,timestamptz,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_site_content(text,text,jsonb,boolean,timestamptz,boolean) TO authenticated;

-- Public covers remain readable, but uploads and changes belong to the admin.
DROP POLICY IF EXISTS fesilent_materials_insert ON storage.objects;
CREATE POLICY fesilent_materials_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_materials_update ON storage.objects;
CREATE POLICY fesilent_materials_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'materials' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com')
WITH CHECK (bucket_id = 'materials' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_materials_delete ON storage.objects;
CREATE POLICY fesilent_materials_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com');
DROP POLICY IF EXISTS fesilent_materials_insert_guard ON storage.objects;
CREATE POLICY fesilent_materials_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (bucket_id <> 'materials' OR ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'));
DROP POLICY IF EXISTS fesilent_materials_update_guard ON storage.objects;
CREATE POLICY fesilent_materials_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
USING (bucket_id <> 'materials' OR ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'))
WITH CHECK (bucket_id <> 'materials' OR ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'));
DROP POLICY IF EXISTS fesilent_materials_delete_guard ON storage.objects;
CREATE POLICY fesilent_materials_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO public
USING (bucket_id <> 'materials' OR ((SELECT auth.role()) = 'authenticated' AND (SELECT auth.jwt() ->> 'email') = 'id19991016@gmail.com'));

NOTIFY pgrst, 'reload schema';
COMMIT;
