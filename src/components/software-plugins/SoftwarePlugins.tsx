"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { AlertCircle, ArrowUpRight, Box, Download, Layers3, Loader2, Monitor, PackageOpen, PenTool, Puzzle, Search, Sparkles, Upload } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { SOFTWARE_HOSTS, PLUGIN_ADMIN_EMAIL, formatPackageSize, type SoftwareHost, type SoftwarePlugin } from "@/lib/software-plugins/catalog";
import { loadSoftwarePlugins } from "@/lib/software-plugins/storage";
import { downloadPluginPackage, PluginDownloadLoginRequiredError, type PluginDownloadProgress } from "@/lib/software-plugins/download";
import { getSupabaseErrorMessage, isSupabaseConnectionError, supabase } from "@/lib/supabase";
import PluginPublisher from "./PluginPublisher";
import { useActionLogin } from "@/components/auth/useActionLogin";
import "./software-plugins.css";

const hosts = SOFTWARE_HOSTS;
const hostIcons = { Blender: Box, PowerPoint: Layers3, Illustrator: PenTool, 其他: Puzzle };

function ToolkitPreview({ host }: { host: SoftwareHost }) {
  if (host === "其他") return <div className="software-preview software-preview--other"><Puzzle size={54} strokeWidth={1.2} aria-hidden="true" /><span className="software-preview-caption">软件插件</span></div>;
  return <div className={`software-preview software-preview--${host.toLowerCase()}`}>
    <svg viewBox="0 0 320 132" fill="none" aria-hidden="true">
      {host === "Blender" ? <>
        <g stroke="#b4b3d4" strokeWidth=".6" opacity=".5">
          {[0, 1, 2, 3, 4, 5].map((index) => <path key={`h${index}`} d={`M${42 + index * 18} ${88 - index * 6}L${172 + index * 18} ${128 - index * 6}`} />)}
          {[0, 1, 2, 3, 4, 5, 6].map((index) => <path key={`v${index}`} d={`M${50 + index * 25} ${91 + index * 7}L${158 + index * 14} ${53 + index * 4}`} />)}
        </g>
        <ellipse cx="170" cy="111" rx="66" ry="12" fill="#8984bb" opacity=".09" />
        <path d="M159 19L219 47L164 75L108 48Z" fill="#c9c7f7" fillOpacity=".85" stroke="#a5a0d7" />
        <path d="M108 48L164 75V119L108 89Z" fill="#a9bce9" fillOpacity=".72" stroke="#929ed0" />
        <path d="M164 75L219 47V92L164 119Z" fill="#dccde9" fillOpacity=".76" stroke="#b1a1d2" />
        <g stroke="#fff" strokeOpacity=".62" strokeWidth=".7"><path d="M126 39L183 66M144 30L201 57M126 57L178 29M145 66L198 38M127 58V99M145 66V109M108 62L164 90M108 76L164 103M182 66V110M201 57V101M164 90L219 62M164 103L219 77" /></g>
        <g fill="#fff" stroke="#8883b9" strokeWidth="1.1">{[[159, 19], [219, 47], [164, 75], [108, 48], [108, 89], [164, 119], [219, 92]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.3" />)}</g>
        <path d="M62 95L85 86M62 95L85 102M62 95V74" strokeWidth="1.5" strokeLinecap="round" stroke="#a39bd2" />
      </> : host === "PowerPoint" ? <>
        <rect x="77" y="12" width="174" height="100" rx="8" fill="#edf0fb" stroke="#d4d9ed" />
        <rect x="62" y="21" width="174" height="100" rx="8" fill="#f8eaf2" fillOpacity=".85" stroke="#e5ccde" />
        <rect x="47" y="30" width="174" height="91" rx="8" fill="#fff" fillOpacity=".91" stroke="#d8d6e8" />
        <path d="M62 46H119M62 52H95" stroke="#aba5bd" strokeWidth="2" strokeLinecap="round" />
        <rect x="61" y="67" width="40" height="30" rx="5" fill="#e1daf4" stroke="#b5a2d9" />
        <circle cx="131" cy="82" r="15" fill="#e0eaf8" stroke="#9fb5dc" />
        <path d="M167 68L184 82L167 96L150 82Z" fill="#f5dae8" stroke="#d3a3bf" />
        <path d="M102 82H114M148 82H154" stroke="#aca0bc" strokeWidth="1.2" />
        <path d="M111 79L114 82L111 85M151 79L154 82L151 85" stroke="#aca0bc" strokeWidth="1.2" />
        <rect x="57" y="62" width="132" height="40" rx="2" stroke="#a99bd1" strokeDasharray="3 3" />
        <g fill="#fff" stroke="#a99bd1">{[[57, 62], [189, 62], [57, 102], [189, 102]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 2} y={y - 2} width="4" height="4" />)}</g>
        <path d="M242 52H270M242 64H263M242 76H270" stroke="#bfb5d1" strokeWidth="4" strokeLinecap="round" />
      </> : <>
        <path d="M65 98C89 30 114 23 154 64C195 105 212 22 257 40L245 111L65 111Z" fill="#e3d8f2" fillOpacity=".64" />
        <path d="M65 98C89 30 114 23 154 64C195 105 212 22 257 40" stroke="#9c7bbb" strokeWidth="2.3" />
        <path d="M65 98L89 30M114 23L154 64L195 105M212 22L257 40" stroke="#ae99c7" strokeWidth=".8" />
        <g fill="#eee5f8" stroke="#a18bbd">{[[89, 30], [114, 23], [195, 105], [212, 22]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />)}</g>
        <g fill="#fff" stroke="#8c6eaa" strokeWidth="1.3">{[[65, 98], [154, 64], [257, 40]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" />)}</g>
        <path d="M50 115H272M50 115V17" stroke="#c8bfd4" strokeWidth=".6" />
        <g stroke="#d1c9db" strokeWidth=".6">{[80, 110, 140, 170, 200, 230, 260].map((x) => <path key={x} d={`M${x} 112V118`} />)}</g>
      </>}
    </svg>
    <span className="software-preview-caption">能力示意</span>
  </div>;
}

function DetailList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  return (
    <section className="software-detail-section">
      <h3>{title}</h3>
      {ordered ? <ol className="resource-detail-list">{items.map((item) => <li key={item}>{item}</li>)}</ol>
        : <ul className="resource-detail-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>}
    </section>
  );
}

function PluginPreview({ plugin }: { plugin: SoftwarePlugin }) {
  if (!plugin.coverUrl) return <ToolkitPreview host={plugin.host} />;
  // Covers are administrator-uploaded, validated bitmap images in our storage.
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="software-preview software-preview--cover"><img src={plugin.coverUrl} alt={`${plugin.name}预览`} loading="lazy" /></div>;
}

export default function SoftwarePlugins() {
  const { requestLogin, showLogin, checking, LoginPrompt } = useActionLogin();
  const [host, setHost] = useState<SoftwareHost | "全部">("全部");
  const [query, setQuery] = useState("");
  const [plugins, setPlugins] = useState<SoftwarePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<SoftwarePlugin | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<SoftwarePlugin | undefined>();
  const [publishingBusy, setPublishingBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<PluginDownloadProgress | null>(null);
  const downloadController = useRef<AbortController | null>(null);

  useEffect(() => () => {
    const controller = downloadController.current;
    downloadController.current = null;
    controller?.abort();
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user } }) => { if (alive) setIsAdmin(user?.email === PLUGIN_ADMIN_EMAIL); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) { setIsAdmin(session?.user.email === PLUGIN_ADMIN_EMAIL); if (session?.user.email !== PLUGIN_ADMIN_EMAIL) { setPublishing(false); setEditingPlugin(undefined); } }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    loadSoftwarePlugins().then(data => {
      if (alive) {
        setPlugins(data); setLoadError(null); setLoading(false);
        const requested = new URLSearchParams(window.location.search).get("plugin");
        if (requested) setSelected(data.find(plugin => plugin.id === requested) ?? null);
      }
    }).catch(error => {
      if (alive) { setLoadError(isSupabaseConnectionError(error) ? "暂时无法连接插件库，请稍后重试。" : (getSupabaseErrorMessage(error) ?? "插件库读取失败，请稍后重试。")); setLoading(false); }
    });
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    const readHash = () => { if (isAdmin && window.location.hash === "#publish") { setEditingPlugin(undefined); setPublishing(true); } };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [isAdmin]);

  const filtered = useMemo(() => plugins.filter(plugin =>
    (host === "全部" || plugin.host === host) && `${plugin.name} ${plugin.host} ${plugin.summary} ${plugin.outputs.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [plugins, host, query]);
  const softwareCount = new Set(plugins.map(plugin => plugin.host)).size;
  const retry = () => { setLoading(true); setLoadError(null); setReloadKey(key => key + 1); };
  const closePublisher = () => { if (publishingBusy) return; setPublishing(false); setEditingPlugin(undefined); if (window.location.hash === "#publish") window.history.replaceState(null, "", window.location.pathname); };
  const closeDetails = () => {
    const controller = downloadController.current;
    downloadController.current = null;
    controller?.abort();
    setSelected(null); setDownloadBusy(false); setDownloadError(""); setDownloadProgress(null);
  };

  const downloadPlugin = async (plugin: SoftwarePlugin) => {
    if (checking || downloadBusy || downloadController.current) return;
    const controller = new AbortController();
    downloadController.current = controller;
    const isCurrent = () => downloadController.current === controller && !controller.signal.aborted;
    setDownloadError("");
    setDownloadProgress(null);
    // Close the detail dialog before displaying the shared login dialog.
    flushSync(() => setSelected(null));
    try {
      if (!await requestLogin("下载软件插件", `/software-plugins?plugin=${encodeURIComponent(plugin.id)}`, controller.signal) || !isCurrent()) return;
      setSelected(plugin);
      setDownloadBusy(true);
      const bytes = await downloadPluginPackage(plugin, { signal: controller.signal, onProgress: progress => { if (isCurrent()) setDownloadProgress(progress); } });
      if (!isCurrent()) return;
      const href = URL.createObjectURL(bytes);
      const link = document.createElement("a");
      link.href = href; link.download = plugin.packageName; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30_000);
    } catch (error) {
      if (!isCurrent()) return;
      setDownloadProgress(null);
      if (error instanceof PluginDownloadLoginRequiredError) {
        flushSync(() => setSelected(null));
        showLogin("下载软件插件", `/software-plugins?plugin=${encodeURIComponent(plugin.id)}`);
      } else setDownloadError(getSupabaseErrorMessage(error) ?? "安装包下载失败，请稍后重试。");
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null;
        setDownloadBusy(false);
      }
    }
  };

  return (
    <main className="resource-page software-plugins-page">
      <section className="resource-hero">
        <div><p className="resource-eyebrow"><Sparkles size={14} aria-hidden="true" /> FESILENT REVERIE / SOFTWARE</p><h1>软件插件</h1><p>为科研创作开发，让工作在熟悉的软件里更顺手。</p></div>
        {isAdmin ? <button type="button" className="resource-button resource-button--primary" onClick={() => { setEditingPlugin(undefined); setPublishing(true); }}><Upload size={16} /> 上传插件</button> : <span className="software-host-badge"><Monitor size={15} aria-hidden="true" /> Fesilent 自研项目</span>}
      </section>

      <section className="resource-stats" aria-label="插件库概览">
        <div className="resource-stat" style={{ "--stat-wash": "#d3c5f4" } as CSSProperties}><span>已发布插件</span><strong>{loading || loadError ? "—" : plugins.length}</strong><small>由管理员上传发布</small></div>
        <div className="resource-stat" style={{ "--stat-wash": "#bfd8f7" } as CSSProperties}><span>覆盖软件</span><strong>{loading || loadError ? "—" : softwareCount}<em> 类</em></strong><small>按适用软件选择工具</small></div>
        <div className="resource-stat" style={{ "--stat-wash": "#f0ccd9" } as CSSProperties}><span>使用方式</span><strong>本地安装</strong><small>中文介绍 · 安装说明 · 下载包</small></div>
      </section>
      {notice && <p className="software-publication-notice" role="status">{notice}</p>}

      <section className="resource-catalog" aria-labelledby="software-catalog-title">
        <div className="software-catalog-heading"><div><h2 id="software-catalog-title">科研创作工具箱</h2><p>点击插件了解功能、适用环境与安装方法。</p></div><span className="resource-meta">{loading ? "加载中" : loadError ? "暂时无法读取" : `${filtered.length} 个插件`}</span></div>
        <div className="resource-toolbar software-toolbar">
          <div className="software-host-filter" role="group" aria-label="按软件筛选">{(["全部", ...hosts] as const).map(value => <button key={value} type="button" className={`resource-chip${host === value ? " is-active" : ""}`} aria-pressed={host === value} onClick={() => setHost(value)}>{value}</button>)}</div>
          <label className="software-search"><Search size={17} aria-hidden="true" /><span className="software-sr-only">搜索软件插件</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索插件或功能" /></label>
        </div>

        {loading ? <div className="software-catalog-state" role="status"><Loader2 size={26} className="software-spin" /><h3>正在读取插件库</h3></div>
          : loadError ? <div className="software-catalog-state" role="alert"><AlertCircle size={28} /><h3>插件库暂时无法加载</h3><p>{loadError}</p><button type="button" className="resource-button" onClick={retry}>重新加载</button></div>
          : plugins.length === 0 ? <div className="software-catalog-state software-catalog-state--empty"><div className="software-empty-orbit" aria-hidden="true"><span><Box size={23} /></span><span><PackageOpen size={38} strokeWidth={1.3} /></span><span><Layers3 size={23} /></span></div><p className="resource-eyebrow">FESILENT ORIGINALS</p><h3>新的科研工具，正在准备中</h3><p>自研插件发布后会在这里展示。<br />功能介绍可自由浏览，登录后下载对应安装包。</p>{isAdmin && <button type="button" className="resource-button resource-button--primary" onClick={() => { setEditingPlugin(undefined); setPublishing(true); }}><Upload size={16} /> 上传第一个插件</button>}</div>
          : <><div className="resource-grid software-plugin-grid">{filtered.map(plugin => {
              const Icon = hostIcons[plugin.host];
              return <button key={plugin.id} type="button" className={`resource-card software-plugin-card software-plugin-card--${plugin.host.toLowerCase()}`} onClick={() => { closeDetails(); setSelected(plugin); }} aria-label={`查看${plugin.name}的功能与下载`}>
                <div className="software-card-top"><span className="software-host-name"><Icon size={14} strokeWidth={1.7} aria-hidden="true" />{plugin.host}</span><span className="software-package-type">自研插件</span></div>
                <PluginPreview plugin={plugin} />
                <div className="software-card-content"><h3>{plugin.name}</h3><p className="software-plugin-subtitle">版本 {plugin.version}</p><p className="software-plugin-summary">{plugin.summary}</p></div>
                <div className="software-output-chips">{plugin.outputs.slice(0, 2).map((output, index) => <span key={index}>{output}</span>)}</div>
                <div className="resource-card-footer"><span>查看功能与下载</span><ArrowUpRight size={17} aria-hidden="true" /></div>
              </button>;
            })}</div>{filtered.length === 0 && <div className="resource-empty"><Search size={28} aria-hidden="true" /><h2>暂未找到匹配的插件</h2><p>换一个关键词，或选择其他软件。</p><button type="button" className="resource-button" onClick={() => { setQuery(""); setHost("全部"); }}>显示全部插件</button></div>}</>}
      </section>

      <ResourceDialog open={selected !== null} onClose={closeDetails} title={selected?.name ?? "插件详情"} eyebrow={selected ? `${selected.host} · Fesilent 自研插件` : undefined} footer={selected && <><button type="button" className="resource-button" onClick={closeDetails}>返回插件库</button>{isAdmin && <button type="button" className="resource-button" disabled={checking || downloadBusy} onClick={() => { const plugin = selected; closeDetails(); setEditingPlugin(plugin); setPublishing(true); }}>更新插件</button>}<button type="button" className="resource-button resource-button--primary" disabled={checking || downloadBusy} onClick={() => downloadPlugin(selected)}>{downloadBusy ? downloadProgress?.stage === "verifying" ? "正在校验…" : "正在下载…" : "下载安装包"} {downloadBusy ? <Loader2 size={16} className="software-spin" /> : <Download size={16} aria-hidden="true" />}</button></>}>
        {selected && <div className="software-plugin-detail"><div className="software-detail-summary"><PluginPreview plugin={selected} /><div><p className="software-detail-intro">{selected.summary}</p><div className="software-download-meta"><span>ZIP 安装包</span><span>版本 {selected.version}</span><span>{formatPackageSize(selected.packageBytes)}</span></div></div></div>
          {selected.features.length > 0 && <DetailList title="能做什么" items={selected.features} />}
          <div className="software-detail-grid">{selected.environment.length > 0 && <DetailList title="运行环境" items={selected.environment} />}{selected.installation.length > 0 && <DetailList title="安装与使用" items={selected.installation} ordered />}</div>
          {selected.outputs.length > 0 && <DetailList title="输出内容" items={selected.outputs} />}
          <p className="resource-meta software-package-provenance">Fesilent Reverie 自研项目 · 由管理员上传发布</p>
          <p className="resource-meta">安装包下载需要登录账号。</p>
          {downloadProgress && <p className="resource-meta" role="status" aria-live="polite">{downloadProgress.stage === "ready" ? "校验完成，请查看浏览器下载。" : <>{downloadProgress.stage === "verifying" ? "正在校验完整安装包" : `已下载 ${downloadProgress.completedParts}/${downloadProgress.totalParts} 块`} · {downloadProgress.downloadedBytes === 0 ? "0 KB" : formatPackageSize(downloadProgress.downloadedBytes)} / {formatPackageSize(downloadProgress.totalBytes)}</>}</p>}
          {downloadError && <p className="plugin-publisher-error" role="alert">{downloadError}</p>}
        </div>}
      </ResourceDialog>
      {LoginPrompt}
      <ResourceDialog open={isAdmin && publishing} onClose={closePublisher} title={editingPlugin ? "更新软件插件" : "发布软件插件"} eyebrow="FESILENT REVERIE / PUBLISH">
        {isAdmin && publishing && <PluginPublisher key={editingPlugin?.id ?? "new"} plugin={editingPlugin} onBusyChange={setPublishingBusy} onPublished={() => { setPublishing(false); setEditingPlugin(undefined); if (window.location.hash === "#publish") window.history.replaceState(null, "", window.location.pathname); setNotice(editingPlugin ? "插件已更新，登录后可下载最新安装包。" : "插件已发布，访客可以查看介绍，登录后下载安装包。"); retry(); }} />}
      </ResourceDialog>
    </main>
  );
}
