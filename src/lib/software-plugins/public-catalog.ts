import { createClient } from "@supabase/supabase-js";
import { PLUGIN_ASSET_TAG, getPluginPackagePath, pluginFromAsset, type PluginAssetRow, type SoftwarePlugin } from "./catalog.ts";

export const PUBLIC_PLUGIN_CATALOG_ERROR = "插件目录暂时无法读取，请稍后重试。";

/** Public reads never inherit a viewer's cookies, expired session, or administrator access. */
export async function loadPublicSoftwarePlugins(): Promise<SoftwarePlugin[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing public catalog configuration");
    const storageOrigin = new URL(url).origin;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
    const { data, error } = await client.from("assets")
      .select("id,title,description,image_url,source_file_url,tags_style,created_at")
      .eq("hidden", false).contains("tags_style", [PLUGIN_ASSET_TAG])
      .order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(12_000));
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Invalid public catalog response");
    const rows = data as PluginAssetRow[];
    if (rows.some(row => !getPluginPackagePath(row.source_file_url) && typeof row.source_file_url === "string" && /^https?:\/\//i.test(row.source_file_url))) {
      throw new Error("Unmigrated public plugin package");
    }
    const plugins = rows.map(row => pluginFromAsset(row, storageOrigin));
    if (plugins.some(plugin => plugin === null)) throw new Error("Invalid plugin metadata");
    return plugins.filter(plugin => plugin !== null);
  } catch {
    throw new Error(PUBLIC_PLUGIN_CATALOG_ERROR);
  }
}
