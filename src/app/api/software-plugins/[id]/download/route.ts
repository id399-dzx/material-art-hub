import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET, getPluginPackageObjects, pluginFromAsset } from "@/lib/software-plugins/catalog";
import { PLUGIN_DOWNLOAD_EXPIRES_SECONDS, getValidatedPluginSignedUrl, type PluginDownloadManifest } from "@/lib/software-plugins/download";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = () => NextResponse.json({ error: "安装包暂时无法下载，请稍后重试。" }, { status: 503, headers });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "请登录账号后下载插件。" }, { status: 401, headers });
  } catch {
    return NextResponse.json({ error: "账号服务暂时无法连接，请稍后重试。" }, { status: 503, headers });
  }

  const { id } = await context.params;
  if (typeof id !== "string" || id.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "插件不存在。" }, { status: 404, headers });
  let row;
  try {
    const { data, error } = await supabase.from("assets").select("id,title,description,image_url,source_file_url,tags_style,created_at")
      .eq("id", id).eq("hidden", false).contains("tags_style", [PLUGIN_ASSET_TAG]).maybeSingle();
    if (error) throw error;
    row = data;
  } catch {
    return NextResponse.json({ error: "插件信息暂时无法读取，请稍后重试。" }, { status: 503, headers });
  }

  try {
    const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    const plugin = row ? pluginFromAsset(row, storageOrigin) : null;
    if (!plugin) return NextResponse.json({ error: "未找到可下载的插件。" }, { status: 404, headers });
    const parts: PluginDownloadManifest["parts"] = [];
    for (const object of getPluginPackageObjects(plugin)) {
      const { data: signed, error: signError } = await supabase.storage.from(PLUGIN_PACKAGE_BUCKET)
        .createSignedUrl(object.path, PLUGIN_DOWNLOAD_EXPIRES_SECONDS);
      const signedUrl = getValidatedPluginSignedUrl(signed?.signedUrl, storageOrigin, object.path);
      if (signError || !signedUrl) return unavailable();
      parts.push({ signedUrl, bytes: object.bytes, ...(object.sha256 ? { sha256: object.sha256 } : {}) });
    }
    // ZIP bytes travel directly from private storage to the verified viewer.
    // This route only returns temporary signatures after checking the session.
    const manifest: PluginDownloadManifest = {
      schema: "fesilent-plugin-download-v1", packageSchema: plugin.schema,
      packageName: plugin.packageName, packageBytes: plugin.packageBytes,
      ...(plugin.schema === "fesilent-plugin-v2" ? { packageSha256: plugin.packageSha256 } : {}),
      expiresIn: PLUGIN_DOWNLOAD_EXPIRES_SECONDS, parts,
    };
    return NextResponse.json(manifest, { headers });
  } catch {
    return unavailable();
  }
}
