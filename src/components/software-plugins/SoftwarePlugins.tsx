"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, Box, Download, Layers3, Monitor, PenTool, Search, Sparkles } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { SOFTWARE_PLUGINS, type SoftwareHost, type SoftwarePlugin } from "@/lib/software-plugins/catalog";
import "./software-plugins.css";

const hosts: SoftwareHost[] = ["Blender", "PowerPoint", "Illustrator"];
const hostIcons = { Blender: Box, PowerPoint: Layers3, Illustrator: PenTool };

function ToolkitPreview({ host }: { host: SoftwareHost }) {
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

export default function SoftwarePlugins() {
  const [host, setHost] = useState<SoftwareHost | "全部">("全部");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SoftwarePlugin | null>(null);
  const filtered = useMemo(() => SOFTWARE_PLUGINS.filter((plugin) =>
    (host === "全部" || plugin.host === host)
    && `${plugin.name} ${plugin.host} ${plugin.summary} ${plugin.outputs.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [host, query]);

  return (
    <main className="resource-page software-plugins-page">
      <section className="resource-hero">
        <div>
          <p className="resource-eyebrow"><Sparkles size={14} aria-hidden="true" /> SOFTWARE TOOLKITS</p>
          <h1>软件插件</h1>
          <p>让科研图与模型在熟悉的软件中继续编辑。</p>
        </div>
        <span className="software-host-badge"><Monitor size={15} aria-hidden="true" /> AI Agent + 本地软件</span>
      </section>

      <section className="resource-stats" aria-label="工具库概览">
        <div className="resource-stat" style={{ "--stat-wash": "#d3c5f4" } as CSSProperties}><span>自有工具包</span><strong>{SOFTWARE_PLUGINS.length}</strong><small>固定版本 · 真实下载</small></div>
        <div className="resource-stat" style={{ "--stat-wash": "#bfd8f7" } as CSSProperties}><span>覆盖软件</span><strong>{hosts.length}<em> 类</em></strong><small>Blender · PowerPoint · Illustrator</small></div>
        <div className="resource-stat" style={{ "--stat-wash": "#f0ccd9" } as CSSProperties}><span>创作与编辑</span><strong>可编辑</strong><small>三维模型 · 原生形状 · 矢量路径</small></div>
      </section>

      <section className="resource-catalog" aria-labelledby="software-catalog-title">
      <div className="software-catalog-heading"><div><h2 id="software-catalog-title">选择你的创作工具</h2><p>点击卡片，查看功能、安装说明与下载版本。</p></div><span className="resource-meta">{filtered.length} 个工具</span></div>
      <div className="resource-toolbar software-toolbar">
        <div className="software-host-filter" role="group" aria-label="按软件筛选">
          {(["全部", ...hosts] as const).map((value) => <button key={value} type="button" className={`resource-chip${host === value ? " is-active" : ""}`} aria-pressed={host === value} onClick={() => setHost(value)}>{value}</button>)}
        </div>
        <label className="software-search"><Search size={17} aria-hidden="true" /><span className="software-sr-only">搜索软件工具</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工具或功能" /></label>
      </div>
      <div className="resource-grid software-plugin-grid">
        {filtered.map((plugin) => {
          const Icon = hostIcons[plugin.host];
          return (
            <button key={plugin.id} type="button" className={`resource-card software-plugin-card software-plugin-card--${plugin.host.toLowerCase()}`} onClick={() => setSelected(plugin)} aria-label={`查看${plugin.name}的功能与下载`}>
              <div className="software-card-top"><span className="software-host-name"><Icon size={14} strokeWidth={1.7} aria-hidden="true" />{plugin.host}</span><span className="software-package-type">Skill 工具包</span></div>
              <ToolkitPreview host={plugin.host} />
              <div className="software-card-content"><h3>{plugin.name}</h3><p className="software-plugin-subtitle">{plugin.subtitle}</p><p className="software-plugin-summary">{plugin.summary}</p></div>
              <div className="software-output-chips">{plugin.outputs.slice(0, 2).map((output) => <span key={output}>{output}</span>)}</div>
              <div className="resource-card-footer"><span>查看功能与下载</span><ArrowUpRight size={17} aria-hidden="true" /></div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="resource-empty"><Search size={28} aria-hidden="true" /><h2>暂未找到匹配的工具</h2><p>换一个关键词，或选择其他软件。</p><button type="button" className="resource-button" onClick={() => { setQuery(""); setHost("全部"); }}>显示全部工具</button></div>}
      </section>

      <aside className="resource-note software-install-note"><Monitor size={19} aria-hidden="true" /><div><strong>使用入口：AI Agent + 本地软件</strong><p>当前收录的是我们开发的 Skill 与脚本工具包。下载后按说明安装到 Agent 的 Skill 目录，由 Agent 配合本地软件使用。</p></div></aside>

      <ResourceDialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? "软件工具详情"} eyebrow={selected ? `${selected.host} · Skill 工具包` : undefined} footer={selected && <><a className="resource-button" href={selected.repositoryUrl} target="_blank" rel="noopener noreferrer">GitHub 详情 <ArrowUpRight size={16} aria-hidden="true" /></a><a className="resource-button resource-button--primary" href={selected.downloadUrl} rel="noopener noreferrer">下载 {selected.downloadKind} <Download size={16} aria-hidden="true" /></a></>}>
        {selected && <div className="software-plugin-detail">
          <div className="software-detail-summary"><ToolkitPreview host={selected.host} /><div><p className="software-detail-intro">{selected.summary}</p><div className="software-download-meta"><span>{selected.downloadKind}</span><span>版本 {selected.version}</span><span>约 {selected.packageSize}</span></div></div></div>
          <DetailList title="能做什么" items={selected.features} />
          <div className="software-detail-grid">
          <DetailList title="运行环境" items={selected.environment} />
          <DetailList title="如何安装与使用" items={selected.installation} ordered />
          </div>
          <div className="software-detail-boundaries">
          <DetailList title="使用说明" items={selected.boundaries} />
          </div>
          <p className="resource-meta software-package-provenance">来源：id399-dzx 公开仓库 · 下载版本已于 {selected.verifiedOn} 检查。</p>
        </div>}
      </ResourceDialog>
    </main>
  );
}
