export const SOFTWARE_HOSTS = ["Blender", "PowerPoint", "Illustrator", "其他"] as const;
export type SoftwareHost = typeof SOFTWARE_HOSTS[number];

// Separate published plugins from artwork using existing assets/storage permissions.
// No local or private projects are seeded into this public catalog.
export const PLUGIN_ASSET_TAG = "__fesilent_software_plugin_v1__";
export const PLUGIN_ADMIN_EMAIL = "id19991016@gmail.com";

export type SoftwarePluginDetails = {
  schema: "fesilent-plugin-v1";
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

export type SoftwarePlugin = SoftwarePluginDetails & {
  id: string;
  name: string;
  coverUrl?: string;
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
  if (details.schema !== "fesilent-plugin-v1" || !SOFTWARE_HOSTS.includes(details.host as SoftwareHost)) throw new Error("插件类型无效。");
  if (!Number.isSafeInteger(details.packageBytes) || (details.packageBytes as number) <= 0 || (details.packageBytes as number) > 50 * 1024 * 1024) throw new Error("插件安装包大小无效。");
  return {
    schema: "fesilent-plugin-v1", host: details.host as SoftwareHost,
    summary: textField(details.summary, "中文简介", 4000),
    version: textField(details.version, "版本", 80),
    features: textList(details.features), environment: textList(details.environment),
    installation: textList(details.installation), outputs: textList(details.outputs),
    packageName: textField(details.packageName, "安装包名称", 255),
    packageBytes: details.packageBytes as number,
  };
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
    const downloadUrl = storedUrl(row.source_file_url, storageOrigin);
    if (!downloadUrl) return null;
    return {
      ...details, id: textField(row.id, "插件编号", 100),
      name: textField(row.title, "插件名称", 160),
      coverUrl: storedUrl(row.image_url, storageOrigin), downloadUrl, publishedAt: row.created_at,
    };
  } catch { return null; }
}

export function formatPackageSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
