import { PLUGIN_PACKAGE_BUCKET, getPluginPackageObjects, type SoftwarePlugin } from "./catalog.ts";

export const PLUGIN_DOWNLOAD_EXPIRES_SECONDS = 600;

export type PluginDownloadManifest = {
  schema: "fesilent-plugin-download-v1";
  packageSchema: SoftwarePlugin["schema"];
  packageName: string;
  packageBytes: number;
  packageSha256?: string;
  expiresIn: number;
  parts: { signedUrl: string; bytes: number; sha256?: string }[];
};

export type PluginDownloadProgress = {
  stage: "downloading" | "verifying" | "ready";
  downloadedBytes: number;
  totalBytes: number;
  completedParts: number;
  totalParts: number;
};

export class PluginDownloadLoginRequiredError extends Error {
  constructor() {
    super("请登录账号后下载插件。");
    this.name = "PluginDownloadLoginRequiredError";
  }
}

/** Require the exact private signing endpoint for the intended storage object. */
export function getValidatedPluginSignedUrl(value: unknown, storageOrigin: string, objectPath: string): string | null {
  if (typeof value !== "string" || value !== value.trim()) return null;
  try {
    const origin = new URL(storageOrigin);
    const url = new URL(value);
    if (!["https:", "http:"].includes(origin.protocol) || url.origin !== origin.origin || url.username || url.password || url.hash) return null;
    if (url.pathname !== `/storage/v1/object/sign/${PLUGIN_PACKAGE_BUCKET}/${objectPath}`) return null;
    if (url.searchParams.getAll("token").length !== 1 || !url.searchParams.get("token")?.trim()) return null;
    if ([...url.searchParams.keys()].some(key => key !== "token")) return null;
    return url.href;
  } catch { return null; }
}

function validateManifest(value: unknown, plugin: SoftwarePlugin, storageOrigin: string): PluginDownloadManifest {
  if (!value || typeof value !== "object") throw new Error("下载清单无效，请刷新插件目录后重试。");
  const manifest = value as Partial<PluginDownloadManifest>;
  const expected = getPluginPackageObjects(plugin);
  const packageSha256 = plugin.schema === "fesilent-plugin-v2" ? plugin.packageSha256 : undefined;
  if (manifest.schema !== "fesilent-plugin-download-v1" || manifest.packageSchema !== plugin.schema
    || manifest.packageName !== plugin.packageName || manifest.packageBytes !== plugin.packageBytes
    || manifest.packageSha256 !== packageSha256 || manifest.expiresIn !== PLUGIN_DOWNLOAD_EXPIRES_SECONDS
    || !Array.isArray(manifest.parts) || manifest.parts.length !== expected.length) {
    throw new Error("下载清单与插件信息不一致，请刷新插件目录后重试。");
  }
  const parts = manifest.parts.map((part, index) => {
    const object = expected[index];
    if (!part || typeof part !== "object" || part.bytes !== object.bytes || part.sha256 !== object.sha256) throw new Error("下载分片信息无效，请刷新插件目录后重试。");
    const signedUrl = getValidatedPluginSignedUrl(part.signedUrl, storageOrigin, object.path);
    if (!signedUrl) throw new Error("安装包下载地址无效，请稍后重试。");
    return { signedUrl, bytes: object.bytes, ...(object.sha256 ? { sha256: object.sha256 } : {}) };
  });
  return { ...manifest, parts } as PluginDownloadManifest;
}

async function sha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("当前浏览器无法验证安装包，请使用支持安全连接的新版浏览器。");
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function readPart(response: Response, expectedBytes: number, onBytes: (bytes: number) => void, signal?: AbortSignal): Promise<Blob> {
  if (!response.body) throw new Error("安装包分片为空，请重新下载。");
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  const cancel = () => { void reader.cancel(signal?.reason).catch(() => undefined); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    signal?.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      received += value.byteLength;
      if (received > expectedBytes) throw new Error("安装包分片大小不符，请重新下载。");
      chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
      onBytes(received);
    }
    if (received !== expectedBytes) throw new Error("安装包分片不完整，请重新下载。");
    return new Blob(chunks, { type: "application/octet-stream" });
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally { signal?.removeEventListener("abort", cancel); reader.releaseLock(); }
}

export async function downloadPluginPackage(plugin: SoftwarePlugin, options: {
  storageOrigin?: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  onProgress?: (progress: PluginDownloadProgress) => void;
} = {}): Promise<Blob> {
  const checkCancelled = () => options.signal?.throwIfAborted();
  checkCancelled();
  const fetchDownload = options.fetch ?? globalThis.fetch;
  const storageOrigin = options.storageOrigin ?? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  let response: Response;
  try {
    response = await fetchDownload(plugin.downloadUrl, { credentials: "same-origin", cache: "no-store", redirect: "error", signal: options.signal });
  } catch {
    checkCancelled();
    throw new Error("下载服务暂时无法连接，请检查网络后重试。");
  }
  checkCancelled();
  if (response.status === 401) throw new PluginDownloadLoginRequiredError();
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    checkCancelled();
    throw new Error(typeof error?.error === "string" ? error.error : "安装包下载失败，请稍后重试。");
  }
  const payload = await response.json().catch(() => null);
  checkCancelled();
  const manifest = validateManifest(payload, plugin, storageOrigin);
  const progress: PluginDownloadProgress = { stage: "downloading", downloadedBytes: 0, totalBytes: manifest.packageBytes, completedParts: 0, totalParts: manifest.parts.length };
  const report = () => { checkCancelled(); options.onProgress?.({ ...progress }); checkCancelled(); };
  report();
  const blobs: Blob[] = [];
  for (const part of manifest.parts) {
    checkCancelled();
    let partResponse: Response;
    try {
      partResponse = await fetchDownload(part.signedUrl, { credentials: "omit", cache: "no-store", redirect: "error", signal: options.signal });
    } catch {
      checkCancelled();
      throw new Error("安装包下载中断，请检查网络后重新下载。");
    }
    checkCancelled();
    if (!partResponse.ok) throw new Error(partResponse.status === 401 || partResponse.status === 403
      ? "下载凭证已过期，请重新点击下载安装包。" : "安装包分片下载失败，请稍后重试。");
    const previousBytes = progress.downloadedBytes;
    let blob: Blob;
    try {
      blob = await readPart(partResponse, part.bytes, bytes => { progress.downloadedBytes = previousBytes + bytes; report(); }, options.signal);
    } catch (error) {
      checkCancelled();
      if (error instanceof Error && /安装包分片/.test(error.message)) throw error;
      throw new Error("安装包下载中断，请检查网络后重新下载。");
    }
    if (part.sha256) {
      const digest = await sha256(blob);
      checkCancelled();
      if (digest !== part.sha256) throw new Error("安装包分片校验失败，请重新下载。");
    }
    blobs.push(blob);
    progress.completedParts++;
    report();
  }
  progress.stage = "verifying";
  report();
  const archive = new Blob(blobs, { type: "application/zip" });
  if (archive.size !== manifest.packageBytes) throw new Error("安装包大小不符，请重新下载。");
  const header = new Uint8Array(await archive.slice(0, 4).arrayBuffer());
  checkCancelled();
  if (header[0] !== 0x50 || header[1] !== 0x4b || !((header[2] === 3 && header[3] === 4) || (header[2] === 5 && header[3] === 6))) throw new Error("下载内容不是有效的 ZIP 安装包，请联系管理员。");
  if (manifest.packageSha256) {
    const digest = await sha256(archive);
    checkCancelled();
    if (digest !== manifest.packageSha256) throw new Error("完整安装包校验失败，请重新下载。");
  }
  progress.stage = "ready";
  report();
  return archive;
}
