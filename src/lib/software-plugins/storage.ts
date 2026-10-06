import { isSupabaseConnectionError, supabase } from "@/lib/supabase";
import { PLUGIN_ADMIN_EMAIL, PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET, PLUGIN_PACKAGE_MAX_BYTES, PLUGIN_PACKAGE_CHUNK_BYTES, getPluginPackageObjects, getPluginPackagePath, pluginFromAsset, validatePluginDetails, type PluginAssetRow, type SoftwareHost, type SoftwarePlugin } from "./catalog";

export type PluginPublicationInput = {
  name: string; host: SoftwareHost; summary: string; version: string;
  features: string[]; environment: string[]; installation: string[]; outputs: string[];
  packageFile: File; coverFile?: File; existingPlugin?: SoftwarePlugin;
};

export type PluginPublicationStage = "checking" | "package" | "cover" | "publishing";
export type PluginPackageUploadProgress = { completed: number; total: number };

function pluginServiceError(error: unknown, stage: PluginPublicationStage | "loading" | "readiness"): Error {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = error instanceof Error ? error.message : typeof details.message === "string" ? details.message : "";
  const code = typeof details.code === "string" ? details.code : "";
  const status = Number(details.statusCode ?? details.status);
  const signature = `${details.name ?? ""} ${code} ${message}`;
  let explanation: string;
  if (/TimeoutError|AbortError|timed?\s*out|aborted/i.test(signature)) {
    explanation = stage === "loading" ? "加载插件目录超时，请检查网络后重试。"
      : stage === "checking" ? "账号验证超时，请检查网络后重试。"
      : stage === "readiness" ? "上传服务检查超时，请检查网络或后台配置后重试。"
      : "请求超时，暂时无法确认发布结果，请刷新插件目录检查后再操作。";
  } else if ((stage === "package" || stage === "cover" || stage === "readiness") && /bucket.*(?:not found|does not exist)|NoSuchBucket/i.test(signature)) {
    explanation = stage === "readiness"
      ? "私有安装包存储尚未就绪（plugin-packages）：可能未创建，或当前管理员无权读取配置。请管理员在 Supabase 执行私有插件包迁移 SQL 后重试。"
      : stage === "package" ? "私有安装包存储尚未配置（plugin-packages）。请管理员先在 Supabase 执行私有插件包迁移 SQL，再重新上传。"
      : "封面存储尚未配置（materials）。请管理员检查 Supabase 的素材存储桶后再上传。";
  } else if (status === 401 || status === 403 || code === "42501" || /row.level security|permission denied|unauthori[sz]ed|not authorized|access.?denied|jwt.*(?:expired|invalid)/i.test(signature)) {
    explanation = stage === "package" ? "私有安装包上传权限被拒绝。请确认已登录管理员账号，并检查 plugin-packages 的上传策略。"
      : stage === "readiness" ? "私有安装包存储检查权限被拒绝。请管理员执行私有插件包迁移 SQL，并检查 plugin-packages 的桶配置读取和对象读取权限。"
      : stage === "cover" ? "封面上传权限被拒绝。请管理员检查 materials 存储桶的上传策略。"
      : stage === "publishing" ? "插件介绍保存权限被拒绝。请管理员检查 assets 表的发布权限（RLS）。"
      : stage === "loading" ? "无法读取插件目录，请管理员检查 assets 表的读取权限（RLS）。"
      : "请登录管理员账号后再发布插件。";
  } else if ((stage === "package" || stage === "cover") && (status === 413 || /too large|size.*exceed|exceed.*size|EntityTooLarge/i.test(signature))) {
    explanation = stage === "package" ? "安装包分片超过存储服务的大小限制，请检查私有桶和项目限额；每个对象需允许 32 MB，完整安装包最多 200 MB。" : "封面超过存储服务的大小限制，请使用 5 MB 以内的图片并检查项目限额。";
  } else if ((stage === "package" || stage === "cover") && /mime.*(?:not supported|not allowed)|InvalidMimeType/i.test(signature)) {
    explanation = stage === "package" ? "私有安装包存储未允许 ZIP 或二进制分片文件，请管理员检查 plugin-packages 的 MIME 类型设置，允许 application/zip 和 application/octet-stream。" : "封面存储未允许该图片类型，请管理员检查 materials 的 MIME 类型设置。";
  } else if ((stage === "publishing" || stage === "loading") && (code === "42P01" || code === "PGRST205" || /(?:table|relation).*assets.*(?:not found|does not exist)/i.test(signature))) {
    explanation = "插件目录使用的 assets 表尚未配置，请管理员检查当前 Supabase 项目的数据库。";
  } else if (isSupabaseConnectionError(error)) {
    explanation = stage === "checking" ? "暂时无法连接账号服务，请稍后重试。"
      : stage === "readiness" ? "暂时无法连接上传服务，请检查网络或 Supabase 项目状态后重试。"
      : stage === "loading" ? "暂时无法连接插件目录，请检查网络后重试。"
      : stage === "publishing" ? "保存插件介绍时连接中断，暂时无法确认发布结果，请刷新插件目录检查后再操作。"
      : stage === "package" ? "安装包上传时连接中断，请检查网络后重试。" : "封面上传时连接中断，请检查网络后重试。";
  } else {
    const action = { checking: "请登录管理员账号后再发布插件", package: "安装包上传失败", cover: "封面上传失败", publishing: "插件介绍保存失败", loading: "插件目录加载失败", readiness: "上传服务检查失败" }[stage];
    explanation = `${action}。${message}`;
  }
  return new Error(explanation, { cause: error });
}

// Only for reads without SDK cancellation support. A late reply cannot proceed
// to the caller's upload flow; this deadline does not claim to cancel the request.
async function readWithDeadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Read request timed out");
      error.name = "TimeoutError";
      reject(error);
    }, 15_000);
  });
  try { return await Promise.race([request, deadline]); }
  finally { clearTimeout(timer); }
}

async function requirePluginAdministrator() {
  const { data: { user }, error } = await readWithDeadline(supabase.auth.getUser())
    .catch(error => { throw pluginServiceError(error, "checking"); });
  if (error) throw pluginServiceError(error, "checking");
  if (user?.email !== PLUGIN_ADMIN_EMAIL) throw new Error("只有管理员可以发布插件，请登录管理员账号。");
}

export async function checkPluginPublicationStorage(): Promise<void> {
  await requirePluginAdministrator();
  // Reading bucket configuration requires the migration's administrator-only
  // SELECT policy on storage.buckets. Listing alone cannot prove a bucket exists.
  const { data: bucket, error: bucketError } = await readWithDeadline(supabase.storage.getBucket(PLUGIN_PACKAGE_BUCKET))
    .catch(error => { throw pluginServiceError(error, "readiness"); });
  if (bucketError) throw pluginServiceError(bucketError, "readiness");
  if (!bucket || bucket.id !== PLUGIN_PACKAGE_BUCKET) throw new Error("无法确认私有安装包存储配置，请管理员执行私有插件包迁移 SQL 并检查桶配置读取权限。");
  if (bucket.public !== false) throw new Error("plugin-packages 必须是私有存储桶，当前配置无法保障登录下载。请管理员执行私有插件包迁移 SQL 后再上传。");
  if (bucket.file_size_limit != null && bucket.file_size_limit < PLUGIN_PACKAGE_CHUNK_BYTES) throw new Error("plugin-packages 的单对象大小限额低于 32 MB，请管理员执行私有插件包迁移 SQL 或调整桶限额。");
  if (bucket.allowed_mime_types?.length) {
    const allowed = bucket.allowed_mime_types.map(type => type.toLowerCase());
    const supports = (mime: string) => allowed.some(type => [mime, "application/*", "*/*"].includes(type));
    if (!supports("application/zip") || !supports("application/octet-stream")) throw new Error("plugin-packages 未允许 ZIP 或二进制分片文件，请管理员检查桶的 MIME 类型设置，允许 application/zip 和 application/octet-stream。");
  }
  const { error: listError } = await supabase.storage.from(PLUGIN_PACKAGE_BUCKET).list("", { limit: 1 }, { signal: AbortSignal.timeout(15_000) })
    .catch(error => { throw pluginServiceError(error, "readiness"); });
  if (listError) throw pluginServiceError(listError, "readiness");
}

export async function loadSoftwarePlugins() {
  const { data, error } = await supabase.from("assets").select("id,title,description,image_url,source_file_url,tags_style,created_at")
    .eq("hidden", false).contains("tags_style", [PLUGIN_ASSET_TAG]).order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(15_000));
  if (error) throw pluginServiceError(error, "loading");
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  const rows = (data as PluginAssetRow[] | null) ?? [];
  if (rows.some(row => !getPluginPackagePath(row.source_file_url) && typeof row.source_file_url === "string" && /^https?:\/\//i.test(row.source_file_url))) throw new Error("部分插件安装包仍使用公开链接，需要管理员迁移到私有存储后再发布。");
  const plugins = rows.map(row => pluginFromAsset(row, origin));
  if (plugins.some(plugin => plugin === null)) throw new Error("部分插件信息不完整，请联系管理员检查发布内容。");
  return plugins.filter(plugin => plugin !== null);
}

async function sha256(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    throw new Error("安装包 SHA-256 校验失败，请重新选择文件或刷新页面后重试。", { cause: error });
  }
}

async function requireCurrentPlugin(existing: SoftwarePlugin): Promise<PluginAssetRow> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing.id)) throw new Error("原插件编号无效，请刷新插件目录后重试。");
  const { data, error } = await Promise.resolve(supabase.from("assets").select("id,title,description,image_url,source_file_url,tags_style,created_at")
    .eq("id", existing.id).contains("tags_style", [PLUGIN_ASSET_TAG]).abortSignal(AbortSignal.timeout(15_000)))
    .catch(error => { throw pluginServiceError(error, "loading"); });
  if (error) throw pluginServiceError(error, "loading");
  const rows = data as PluginAssetRow[] | null;
  if (!rows || rows.length !== 1) throw new Error("原插件已删除或不在插件目录中，请刷新插件目录后重试。");
  const row = rows[0];
  const current = pluginFromAsset(row, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin);
  if (!current) throw new Error("原插件信息无效，无法更新，请刷新插件目录后重试。");
  let matches = false;
  try {
    matches = current.id === existing.id && current.name === existing.name
      && current.packagePath === existing.packagePath && current.coverUrl === existing.coverUrl
      && current.publishedAt === existing.publishedAt
      && JSON.stringify(validatePluginDetails(current)) === JSON.stringify(validatePluginDetails(existing));
  } catch { /* A stale or malformed client snapshot cannot authorize an update. */ }
  if (!matches) throw new Error("插件已被修改，请刷新插件目录后重新选择要更新的插件。");
  return row;
}

function isDefinitePublicationRejection(error: unknown, status?: number): boolean {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const signature = `${details.name ?? ""} ${details.code ?? ""} ${details.message ?? String(error)}`;
  const responseStatus = status ?? Number(details.statusCode ?? details.status);
  // The SDK also returns status 0 with empty-code errors when parsing a reply
  // fails. That reply may have followed a successful write, so retain the files.
  if (responseStatus === 0 || responseStatus === 408 || responseStatus >= 500
    || isSupabaseConnectionError(error) || /SyntaxError|TimeoutError|AbortError|timed?\s*out|aborted/i.test(signature)) return false;
  if (responseStatus >= 400 && responseStatus < 500) return true;
  const code = String(details.code ?? "");
  return /^(?:22|23|28|42|P0)[A-Z0-9]{3}$/.test(code) || /^PGRST(?:1|2|3)\d{2}$/.test(code);
}

export async function publishSoftwarePlugin(input: PluginPublicationInput, onStage?: (stage: PluginPublicationStage) => void, onPackageProgress?: (progress: PluginPackageUploadProgress) => void) {
  onStage?.("checking");
  await requirePluginAdministrator();
  const existingRow = input.existingPlugin ? await requireCurrentPlugin(input.existingPlugin) : undefined;
  if (!input.name.trim() || input.name.length > 160) throw new Error("请填写插件名称，最多 160 字。");
  if (!input.packageFile || !/\.zip$/i.test(input.packageFile.name)) throw new Error("请将插件与使用说明打包为 ZIP 后上传。");
  if (!Number.isSafeInteger(input.packageFile.size) || input.packageFile.size <= 0 || input.packageFile.size > PLUGIN_PACKAGE_MAX_BYTES) throw new Error("插件安装包大小无效，请使用 200 MB 以内的 ZIP 文件。");
  const header = new Uint8Array(await input.packageFile.slice(0, 4).arrayBuffer().catch(() => { throw new Error("安装包内容无法读取，请重新选择 ZIP 文件。"); }));
  if (header[0] !== 0x50 || header[1] !== 0x4b || !((header[2] === 3 && header[3] === 4) || (header[2] === 5 && header[3] === 6))) throw new Error("安装包不是有效的 ZIP 文件。");
  const packageMetadata = { ...input, packageName: input.packageFile.name, packageBytes: input.packageFile.size };
  const chunked = input.packageFile.size > PLUGIN_PACKAGE_CHUNK_BYTES;
  const details = chunked ? await (async () => {
    const buffer = await input.packageFile.arrayBuffer().catch(() => { throw new Error("安装包内容无法读取，请重新选择 ZIP 文件。"); });
    if (buffer.byteLength !== input.packageFile.size) throw new Error("安装包实际大小与文件信息不一致，请重新选择 ZIP 文件。");
    const bytes = new Uint8Array(buffer);
    const packageSha256 = await sha256(buffer);
    const packageChunks = [];
    for (let offset = 0; offset < bytes.length; offset += PLUGIN_PACKAGE_CHUNK_BYTES) {
      const chunk = bytes.subarray(offset, Math.min(offset + PLUGIN_PACKAGE_CHUNK_BYTES, bytes.length));
      packageChunks.push({ bytes: chunk.byteLength, sha256: await sha256(chunk) });
    }
    return validatePluginDetails({ ...packageMetadata, schema: "fesilent-plugin-v2", packageSha256, packageChunks });
  })() : validatePluginDetails({ ...packageMetadata, schema: "fesilent-plugin-v1" });
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
  let cleanupAllowed = true;
  let stage: PluginPublicationStage = "package";
  let publicationError: Error | undefined;
  let activePackageObject = 0;
  const packagePath = `${uploadId}/${chunked ? "package.parts" : "package.zip"}`;
  const packageObjects = getPluginPackageObjects(details, packagePath);
  try {
    onStage?.(stage);
    onPackageProgress?.({ completed: 0, total: packageObjects.length });
    const uploadedPackagePaths: string[] = [];
    for (const [index, object] of packageObjects.entries()) {
      activePackageObject = index;
      const type = chunked ? "application/octet-stream" : "application/zip";
      const part = chunked ? input.packageFile.slice(index * PLUGIN_PACKAGE_CHUNK_BYTES, index * PLUGIN_PACKAGE_CHUNK_BYTES + object.bytes) : input.packageFile;
      // Supabase multipart upload uses the Blob MIME, including when the browser
      // reports an empty or unsupported type for the original ZIP.
      const body = new Blob([part], { type });
      const { error: packageError } = await supabase.storage.from(PLUGIN_PACKAGE_BUCKET).upload(object.path, body, { contentType: type, upsert: false });
      if (packageError) throw packageError;
      uploadedPackagePaths.push(object.path);
      uploaded.set(PLUGIN_PACKAGE_BUCKET, uploadedPackagePaths);
      onPackageProgress?.({ completed: index + 1, total: packageObjects.length });
    }
    const packageReference = `storage://${PLUGIN_PACKAGE_BUCKET}/${packagePath}`;
    let coverUrl = "";
    if (cover) {
      stage = "cover";
      onStage?.(stage);
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[cover.type];
      const coverPath = `${coverDirectory}/cover.${extension}`;
      const { error: coverError } = await supabase.storage.from("materials").upload(coverPath, cover, { contentType: cover.type, upsert: false });
      if (coverError) throw coverError;
      uploaded.set("materials", [coverPath]);
      coverUrl = supabase.storage.from("materials").getPublicUrl(coverPath).data.publicUrl;
    }
    stage = "publishing";
    onStage?.(stage);
    // Once a write starts, a lost reply may conceal a committed change. Only a
    // definite rejection or zero matching rows permits removing staged objects.
    cleanupAllowed = false;
    if (existingRow) {
      const { data, error: updateError, status } = await supabase.from("assets").update({
        title: input.name.trim(), description: JSON.stringify(details), source_file_url: packageReference,
        ...(cover ? { image_url: coverUrl } : {}),
      }).eq("id", existingRow.id).contains("tags_style", [PLUGIN_ASSET_TAG])
        .eq("title", existingRow.title).eq("description", existingRow.description)
        .eq("source_file_url", existingRow.source_file_url!).eq("image_url", existingRow.image_url)
        .eq("created_at", existingRow.created_at).select("id,source_file_url");
      if (updateError) {
        cleanupAllowed = isDefinitePublicationRejection(updateError, status);
        throw updateError;
      }
      if (Array.isArray(data) && data.length === 0) {
        cleanupAllowed = true;
        throw new Error("插件已被修改或已不可用，请刷新插件目录后重试。");
      }
      if (!Array.isArray(data) || data.length !== 1 || data[0].id !== existingRow.id || data[0].source_file_url !== packageReference) {
        throw new Error("插件更新结果无法确认，请刷新插件目录检查后再操作。");
      }
    } else {
      const { error: insertError, status } = await supabase.from("assets").insert({
        title: input.name.trim(), description: JSON.stringify(details),
        image_url: coverUrl || "/plugin-placeholder.svg", source_file_url: packageReference,
        tags_application: [], tags_material: [], tags_process: [], tags_style: [PLUGIN_ASSET_TAG],
        created_at: new Date().toISOString(),
      });
      if (insertError) {
        cleanupAllowed = isDefinitePublicationRejection(insertError, status);
        throw insertError;
      }
    }
    published = true;
  } catch (error) {
    publicationError = pluginServiceError(error, stage);
    if (stage === "publishing" && !cleanupAllowed && !/无法确认|结果无法确认/.test(publicationError.message)) {
      publicationError = new Error("保存插件介绍时暂时无法确认发布结果，请刷新插件目录检查后再操作。", { cause: error });
    }
    if (stage === "package" && chunked) publicationError = new Error(`${publicationError.message}（第 ${activePackageObject + 1}/${packageObjects.length} 个分片）`, { cause: error });
    throw publicationError;
  } finally {
    if (!published && cleanupAllowed && uploaded.size) {
      let cleanupFailed = false;
      for (const [bucket, paths] of uploaded) {
        try {
          const { error: cleanupError } = await supabase.storage.from(bucket).remove(paths);
          if (cleanupError) cleanupFailed = true;
        } catch { cleanupFailed = true; }
      }
      if (cleanupFailed) throw new Error(`${publicationError?.message ?? ""} 插件未成功发布，且暂存文件清理失败。请管理员检查 plugin-packages 与 materials 中的本次上传文件后重试。`, { cause: publicationError });
    }
  }
}
