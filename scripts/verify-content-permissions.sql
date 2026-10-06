-- Run in SQL Editor. All temporary state is rolled back.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.site_content(section,item_id) VALUES ('templates','__permission_test__');
    RAISE EXCEPTION 'Anonymous insert unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b1c53748-b3f1-4c6d-8c3c-aa5112984777","email":"ordinary-user@example.invalid"}', true);
DO $$
DECLARE changed integer;
BEGIN
  BEGIN
    INSERT INTO public.site_content(section,item_id) VALUES ('templates','__permission_test__');
    RAISE EXCEPTION 'Ordinary-user insert unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.assets SET title = title;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Ordinary-user update unexpectedly allowed'; END IF;
  BEGIN
    PERFORM public.manage_site_content('templates','__permission_test__','{}',false,NULL,false);
    RAISE EXCEPTION 'Ordinary-user RPC unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b1c53748-b3f1-4c6d-8c3c-aa5112984777","email":"id19991016@gmail.com"}', true);
DO $$
DECLARE version timestamptz; changed integer;
BEGIN
  SELECT updated_at INTO version FROM public.manage_site_content('templates','__permission_test__','{"name":"temporary"}',false,NULL,false);
  IF version IS NULL THEN RAISE EXCEPTION 'Admin insert failed'; END IF;
  SELECT count(*) INTO changed FROM public.manage_site_content('templates','__permission_test__','{}',false,NULL,false);
  IF changed <> 0 THEN RAISE EXCEPTION 'Creation conflict was not rejected'; END IF;
  SELECT count(*) INTO changed FROM public.manage_site_content('templates','__permission_test__','{"name":"temporary"}',true,version,false);
  IF changed <> 1 THEN RAISE EXCEPTION 'Admin hide failed'; END IF;
  SELECT count(*) INTO changed FROM public.manage_site_content('templates','__permission_test__','{}',false,version,false);
  IF changed <> 0 THEN RAISE EXCEPTION 'Stale update was not rejected'; END IF;
END $$;
-- Validate the active-package policy against a real existing plugin in a
-- transaction invisible to other connections; rollback restores its visibility.
SELECT set_config('fesilent.test.plugin_id', id::text, true),
       set_config('fesilent.test.plugin_root', split_part(source_file_url,'/',4), true)
FROM public.assets WHERE NOT hidden AND tags_style @> ARRAY['__fesilent_software_plugin_v1__']::text[]
ORDER BY created_at DESC LIMIT 1;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b1c53748-b3f1-4c6d-8c3c-aa5112984777","email":"ordinary-user@example.invalid"}', true);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='plugin-packages' AND split_part(name,'/',1)=current_setting('fesilent.test.plugin_root')) THEN
    RAISE EXCEPTION 'Active package cannot be read by ordinary account';
  END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b1c53748-b3f1-4c6d-8c3c-aa5112984777","email":"id19991016@gmail.com"}', true);
UPDATE public.assets SET hidden = true WHERE id::text = current_setting('fesilent.test.plugin_id');
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b1c53748-b3f1-4c6d-8c3c-aa5112984777","email":"ordinary-user@example.invalid"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='plugin-packages' AND split_part(name,'/',1)=current_setting('fesilent.test.plugin_root')) THEN
    RAISE EXCEPTION 'Hidden package unexpectedly readable by ordinary account';
  END IF;
END $$;
ROLLBACK;
SELECT 'PASS: anonymous and ordinary writes denied; admin CAS, reversible hide and active/hidden private packages verified; all test data rolled back' AS result;
