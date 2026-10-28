import { getPluginPackageObjects, validatePluginDetails, type SoftwarePlugin } from "./catalog.ts";

const INVALID_RESPONSE = "插件目录响应格式有误，请刷新页面后重试。";

function catalogPlugin(value: unknown): SoftwarePlugin {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(INVALID_RESPONSE);
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
    || typeof item.name !== "string" || !item.name.trim() || item.name.length > 160
    || item.downloadUrl !== `/api/software-plugins/${encodeURIComponent(item.id)}/download`
    || typeof item.packagePath !== "string" || typeof item.publishedAt !== "string"
    || (item.coverUrl !== undefined && typeof item.coverUrl !== "string")) throw new Error(INVALID_RESPONSE);
  const plugin: SoftwarePlugin = {
    ...validatePluginDetails(item), id: item.id, name: item.name,
    downloadUrl: item.downloadUrl, packagePath: item.packagePath, publishedAt: item.publishedAt,
    ...(typeof item.coverUrl === "string" ? { coverUrl: item.coverUrl } : {}),
  };
  getPluginPackageObjects(plugin);
  return plugin;
}

/** Browser catalog requests stay on the website's origin, independent of account refresh. */
export async function loadPluginCatalog(fetcher: typeof fetch = fetch): Promise<SoftwarePlugin[]> {
  let response: Response;
  try {
    response = await fetcher("/api/software-plugins", {
      method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    throw new Error(/TimeoutError|AbortError/.test(name)
      ? "加载插件目录超时，请稍后重试。"
      : "暂时无法连接插件目录，请检查网络后重试。", { cause: error });
  }
  if (!response.ok) throw new Error("插件目录服务暂时无法读取，请稍后重试。");
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("plugins" in payload) || !Array.isArray(payload.plugins)) throw new Error(INVALID_RESPONSE);
    return payload.plugins.map(catalogPlugin);
  } catch (error) {
    throw new Error(INVALID_RESPONSE, { cause: error });
  }
}
