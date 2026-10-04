import { isSupabaseConnectionError, supabase } from "@/lib/supabase";
import { PLUGIN_ADMIN_EMAIL, PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET, getPluginPackagePath, pluginFromAsset, validatePluginDetails, type PluginAssetRow, type SoftwareHost } from "./catalog";

export type PluginPublicationInput = {
  name: string; host: SoftwareHost; summary: string; version: string;
  features: string[]; environment: string[]; installation: string[]; outputs: string[];
  packageFile: File; coverFile?: File;
};

export async function loadSoftwarePlugins() {
  const { data, error } = await supabase.from("assets").select("id,title,description,image_url,source_file_url,tags_style,created_at")
    .contains("tags_style", [PLUGIN_ASSET_TAG]).order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(15_000));
  if (error) throw error;
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  const rows = (data as PluginAssetRow[] | null) ?? [];
  if (rows.some(row => !getPluginPackagePath(row.source_file_url) && typeof row.source_file_url === "string" && /^https?:\/\//i.test(row.source_file_url))) throw new Error("部分插件安装包仍使用公开链接，需要管理员迁移到私有存储后再发布。");
  const plugins = rows.map(row => pluginFromAsset(row, origin));
  if (plugins.some(plugin => plugin === null)) throw new Error("部分插件信息不完整，请联系管理员检查发布内容。");
  return plugins.filter(plugin => plugin !== null);
}

export async function publishSoftwarePlugin(input: PluginPublicationInput) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(isSupabaseConnectionError(authError) ? "暂时无法连接账号服务，请稍后重试。" : "请登录管理员账号后再发布插件。");
  if (user?.email !== PLUGIN_ADMIN_EMAIL) throw new Error("只有管理员可以发布插件，请登录管理员账号。");
  if (!input.name.trim() || input.name.length > 160) throw new Error("请填写插件名称，最多 160 字。");
  if (!input.packageFile || !/\.zip$/i.test(input.packageFile.name)) throw new Error("请将插件与使用说明打包为 ZIP 后上传。");
  const header = new Uint8Array(await input.packageFile.slice(0, 4).arrayBuffer());
  if (header[0] !== 0x50 || header[1] !== 0x4b || !((header[2] === 3 && header[3] === 4) || (header[2] === 5 && header[3] === 6))) throw new Error("安装包不是有效的 ZIP 文件。");
  const details = validatePluginDetails({ ...input, schema: "fesilent-plugin-v1", packageName: input.packageFile.name, packageBytes: input.packageFile.size });
  const cover = input.coverFile;
  if (cover && (!['image/png', 'image/jpeg', 'image/webp'].includes(cover.type) || cover.size <= 0 || cover.size > 5 * 1024 * 1024)) throw new Error("封面请使用 5 MB 以内的 PNG、JPG 或 WEBP 图片。");
  if (cover) {
    const bitmap = await createImageBitmap(cover).catch(() => { throw new Error("封面无法读取，请重新选择图片。"); });
    const tooLarge = bitmap.width * bitmap.height > 40_000_000;
    bitmap.close();
    if (tooLarge) throw new Error("封面像素过大，请先缩小至 4000 万像素以内。");
  }

  const uploadId = crypto.randomUUID();
  const coverDirectory = `uploads/plugins/${uploadId}`;
  const uploaded = new Map<string, string[]>();
  let published = false;
  try {
    const packagePath = `${uploadId}/package.zip`;
    const { error: packageError } = await supabase.storage.from(PLUGIN_PACKAGE_BUCKET).upload(packagePath, input.packageFile, { contentType: "application/zip", upsert: false });
    if (packageError) throw packageError;
    uploaded.set(PLUGIN_PACKAGE_BUCKET, [packagePath]);
    const packageReference = `storage://${PLUGIN_PACKAGE_BUCKET}/${packagePath}`;
    let coverUrl = "";
    if (cover) {
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[cover.type];
      const coverPath = `${coverDirectory}/cover.${extension}`;
      const { error: coverError } = await supabase.storage.from("materials").upload(coverPath, cover, { contentType: cover.type, upsert: false });
      if (coverError) throw coverError;
      uploaded.set("materials", [coverPath]);
      coverUrl = supabase.storage.from("materials").getPublicUrl(coverPath).data.publicUrl;
    }
    const { error: insertError } = await supabase.from("assets").insert({
      title: input.name.trim(), description: JSON.stringify(details),
      image_url: coverUrl || "/plugin-placeholder.svg", source_file_url: packageReference,
      tags_application: [], tags_material: [], tags_process: [], tags_style: [PLUGIN_ASSET_TAG],
      created_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;
    published = true;
  } finally {
    if (!published && uploaded.size) {
      let cleanupFailed = false;
      for (const [bucket, paths] of uploaded) {
        try {
          const { error: cleanupError } = await supabase.storage.from(bucket).remove(paths);
          if (cleanupError) cleanupFailed = true;
        } catch { cleanupFailed = true; }
      }
      if (cleanupFailed) throw new Error("插件未成功发布，且暂存文件清理失败。请管理员检查 plugin-packages 与 materials 中的本次上传文件后重试。");
    }
  }
}
