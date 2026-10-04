import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET, pluginFromAsset } from "@/lib/software-plugins/catalog";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "请登录账号后下载插件。" }, { status: 401, headers });

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "插件不存在。" }, { status: 404, headers });
  const { data, error } = await supabase.from("assets").select("id,title,description,image_url,source_file_url,tags_style,created_at")
    .eq("id", id).contains("tags_style", [PLUGIN_ASSET_TAG]).maybeSingle();
  if (error) return NextResponse.json({ error: "插件信息暂时无法读取，请稍后重试。" }, { status: 503, headers });
  const plugin = data ? pluginFromAsset(data, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) : null;
  if (!plugin) return NextResponse.json({ error: "未找到可下载的插件。" }, { status: 404, headers });

  const { data: signed, error: signError } = await supabase.storage.from(PLUGIN_PACKAGE_BUCKET)
    .createSignedUrl(plugin.packagePath, 60, { download: plugin.packageName });
  if (signError || !signed?.signedUrl) return NextResponse.json({ error: "安装包暂时无法下载，请稍后重试。" }, { status: 503, headers });
  // Keep the temporary storage URL on the server. Every public download request
  // must verify the caller's session; ZIP bytes stream without buffering the file.
  try {
    const url = new URL(signed.signedUrl);
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) throw new Error("Unexpected storage origin");
    const upstream = await fetch(url, { cache: "no-store", redirect: "error", signal: request.signal });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "安装包暂时无法下载，请稍后重试。" }, { status: 503, headers });
    const encodedFilename = encodeURIComponent(plugin.packageName).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(upstream.body, { headers: {
      ...headers,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="plugin-${id}.zip"; filename*=UTF-8''${encodedFilename}`,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "安装包暂时无法下载，请稍后重试。" }, { status: 503, headers });
  }
}
