export const SOFTWARE_HOSTS = ["Blender", "PowerPoint", "Illustrator", "其他"] as const;
export type SoftwareHost = typeof SOFTWARE_HOSTS[number];

// Separate published plugins from artwork using existing assets/storage permissions.
// No local or private projects are seeded into this public catalog.
export const PLUGIN_ASSET_TAG = "__fesilent_software_plugin_v1__";
export const PLUGIN_ADMIN_EMAIL = "id19991016@gmail.com";
export const PLUGIN_PACKAGE_BUCKET = "plugin-packages";
export const PLUGIN_PACKAGE_MAX_BYTES = 200 * 1024 * 1024;
export const PLUGIN_PACKAGE_CHUNK_BYTES = 32 * 1024 * 1024;
const LEGACY_PACKAGE_MAX_BYTES = 50 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === "string" && value.length === 36 && UUID_PATTERN.test(value);
const isSha256 = (value: unknown): value is string => typeof value === "string" && value.length === 64 && /^[0-9a-f]{64}$/.test(value);

/** A storage reference is metadata, never a public URL. Keep parsing strict and unnormalised. */
export function getPluginPackagePath(value: unknown): string | null {
  const prefix = `storage://${PLUGIN_PACKAGE_BUCKET}/`;
  if (typeof value !== "string" || !value.startsWith(prefix)) return null;
  const path = value.slice(prefix.length);
  const parts = path.split("/");
  return parts.length === 2 && isUuid(parts[0]) && ["package.zip", "package.parts"].includes(parts[1]) ? path : null;
}

type SoftwarePluginDescription = {
  host: SoftwareHost;
  summary: string;
  version: string;
  features: string[];
  environment: string[];
  installation: string[];
  outputs: string[];
  packageName: string;
  packageBytes: number;
};

export type PluginPackageChunk = { bytes: number; sha256: string };
export type PluginPackageObject = { path: string; bytes: number; sha256?: string };
export type SoftwarePluginDetails = SoftwarePluginDescription & (
  { schema: "fesilent-plugin-v1" }
  | { schema: "fesilent-plugin-v2"; packageSha256: string; packageChunks: PluginPackageChunk[] }
);

export type SoftwarePlugin = SoftwarePluginDetails & {
  id: string;
  name: string;
  coverUrl?: string;
  packagePath: string;
  downloadUrl: string;
  publishedAt: string;
};

export type PluginAssetRow = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  source_file_url?: string | null;
  tags_style?: string[] | null;
  created_at: string;
};

export function isPluginAsset(asset: { tags_style?: string[] | null }): boolean {
  return asset.tags_style?.includes(PLUGIN_ASSET_TAG) ?? false;
}

function textField(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) throw new Error(`请填写有效的${name}。`);
  return value.trim();
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 40 || value.some(item => typeof item !== "string" || !item.trim() || item.length > 1000)) throw new Error("插件说明格式有误，请每行填写一条内容。");
  return value.map(item => item.trim());
}

export function validatePluginDetails(value: unknown): SoftwarePluginDetails {
  if (!value || typeof value !== "object") throw new Error("插件信息格式有误。");
  const details = value as Record<string, unknown>;
  if (!["fesilent-plugin-v1", "fesilent-plugin-v2"].includes(details.schema as string) || !SOFTWARE_HOSTS.includes(details.host as SoftwareHost)) throw new Error("插件类型无效。");
  const packageBytes = details.packageBytes as number;
  const maximumBytes = details.schema === "fesilent-plugin-v1" ? LEGACY_PACKAGE_MAX_BYTES : PLUGIN_PACKAGE_MAX_BYTES;
  if (!Number.isSafeInteger(packageBytes) || packageBytes <= 0 || packageBytes > maximumBytes) throw new Error(`插件安装包大小无效，${details.schema === "fesilent-plugin-v1" ? "旧版安装包最多 50 MB" : "安装包最多 200 MB"}。`);
  const description: SoftwarePluginDescription = {
    host: details.host as SoftwareHost,
    summary: textField(details.summary, "中文简介", 4000),
    version: textField(details.version, "版本", 80),
    features: textList(details.features), environment: textList(details.environment),
    installation: textList(details.installation), outputs: textList(details.outputs),
    packageName: textField(details.packageName, "安装包名称", 255),
    packageBytes,
  };
  if (details.schema === "fesilent-plugin-v1") return { schema: "fesilent-plugin-v1", ...description };
  if (packageBytes <= PLUGIN_PACKAGE_CHUNK_BYTES) throw new Error("分片安装包必须大于 32 MB。");
  if (!isSha256(details.packageSha256)) throw new Error("安装包 SHA-256 校验值无效。");
  const chunkCount = Math.ceil(packageBytes / PLUGIN_PACKAGE_CHUNK_BYTES);
  if (!Array.isArray(details.packageChunks) || details.packageChunks.length !== chunkCount) throw new Error("安装包分片数量与总大小不一致。");
  const packageChunks = Array.from(details.packageChunks, (value: unknown, index: number): PluginPackageChunk => {
    if (!value || typeof value !== "object") throw new Error("安装包分片信息格式有误。");
    const chunk = value as Record<string, unknown>;
    const expectedBytes = index === chunkCount - 1 ? packageBytes - index * PLUGIN_PACKAGE_CHUNK_BYTES : PLUGIN_PACKAGE_CHUNK_BYTES;
    if (!Number.isSafeInteger(chunk.bytes) || chunk.bytes !== expectedBytes || (chunk.bytes as number) <= 0 || (chunk.bytes as number) > PLUGIN_PACKAGE_CHUNK_BYTES) throw new Error("安装包分片大小或顺序无效。");
    if (!isSha256(chunk.sha256)) throw new Error("安装包分片 SHA-256 校验值无效。");
    return { bytes: chunk.bytes as number, sha256: chunk.sha256 };
  });
  return { schema: "fesilent-plugin-v2", ...description, packageSha256: details.packageSha256, packageChunks };
}

/** Derive storage objects only from validated metadata; records cannot choose arbitrary paths. */
export function getPluginPackageObjects(plugin: SoftwarePlugin): PluginPackageObject[];
export function getPluginPackageObjects(details: SoftwarePluginDetails, packagePath: string): PluginPackageObject[];
export function getPluginPackageObjects(value: SoftwarePluginDetails, suppliedPath?: string): PluginPackageObject[] {
  const details = validatePluginDetails(value);
  const packagePath = suppliedPath ?? (value as SoftwarePlugin).packagePath;
  if (!getPluginPackagePath(`storage://${PLUGIN_PACKAGE_BUCKET}/${packagePath}`)) throw new Error("安装包私有存储路径无效。");
  const [directory, filename] = packagePath.split("/");
  if (details.schema === "fesilent-plugin-v1") {
    if (filename !== "package.zip") throw new Error("旧版安装包信息必须对应 package.zip。");
    return [{ path: packagePath, bytes: details.packageBytes }];
  }
  if (filename !== "package.parts") throw new Error("分片安装包信息必须对应 package.parts。");
  return details.packageChunks.map((chunk, index) => ({ path: `${directory}/part-${String(index).padStart(3, "0")}.bin`, ...chunk }));
}

function storedUrl(value: string | null | undefined, storageOrigin: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.origin !== storageOrigin || !url.pathname.startsWith("/storage/v1/object/public/materials/uploads/plugins/")) return undefined;
    return url.href;
  } catch { return undefined; }
}

export function pluginFromAsset(row: PluginAssetRow, storageOrigin: string): SoftwarePlugin | null {
  if (!isPluginAsset(row)) return null;
  try {
    const details = validatePluginDetails(JSON.parse(row.description));
    const packagePath = getPluginPackagePath(row.source_file_url);
    if (!packagePath || !isUuid(row.id)) return null;
    getPluginPackageObjects(details, packagePath);
    return {
      ...details, id: textField(row.id, "插件编号", 100),
      name: textField(row.title, "插件名称", 160),
      coverUrl: storedUrl(row.image_url, storageOrigin), packagePath,
      downloadUrl: `/api/software-plugins/${encodeURIComponent(row.id)}/download`, publishedAt: row.created_at,
    };
  } catch { return null; }
}

export function formatPackageSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
