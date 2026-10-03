"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Box, Download, Layers3, Monitor, PenTool, Search, Sparkles } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { SOFTWARE_PLUGINS, type SoftwareHost, type SoftwarePlugin } from "@/lib/software-plugins/catalog";
import "./software-plugins.css";

const hosts: SoftwareHost[] = ["Blender", "PowerPoint", "Illustrator"];
const hostIcons = { Blender: Box, PowerPoint: Layers3, Illustrator: PenTool };

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
          <p>把灵感带入你熟悉的软件。发现科研绘图与建模工具，查看功能、运行环境和安装方法。</p>
        </div>
        <div className="software-hero-stat"><strong>{SOFTWARE_PLUGINS.length}</strong><span>自有工具包</span><small>Blender · PPT · Illustrator</small></div>
      </section>

      <div className="resource-toolbar software-toolbar">
        <div className="software-host-filter" role="group" aria-label="按软件筛选">
          {(["全部", ...hosts] as const).map((value) => <button key={value} type="button" className={`resource-chip${host === value ? " is-active" : ""}`} aria-pressed={host === value} onClick={() => setHost(value)}>{value}</button>)}
        </div>
        <label className="software-search"><Search size={17} aria-hidden="true" /><span className="software-sr-only">搜索软件工具</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工具或功能" /></label>
      </div>
      <p className="resource-meta software-catalog-caption">{filtered.length} 个工具 · 点击卡片查看中文介绍与下载</p>

      <div className="resource-grid software-plugin-grid">
        {filtered.map((plugin) => {
          const Icon = hostIcons[plugin.host];
          return (
            <button key={plugin.id} type="button" className={`resource-card software-plugin-card software-plugin-card--${plugin.host.toLowerCase()}`} onClick={() => setSelected(plugin)} aria-label={`查看${plugin.name}的功能与下载`}>
              <div className="software-card-top"><span className="resource-card-icon"><Icon size={27} strokeWidth={1.6} aria-hidden="true" /></span><span className="software-package-type">Skill 工具包</span></div>
              <div className="software-card-content"><span className="software-host-name">{plugin.host}</span><h2>{plugin.name}</h2><p className="software-plugin-subtitle">{plugin.subtitle}</p><p className="software-plugin-summary">{plugin.summary}</p></div>
              <div className="software-output-chips">{plugin.outputs.slice(0, 2).map((output) => <span key={output}>{output}</span>)}</div>
              <div className="resource-card-footer"><span>查看功能与下载</span><ArrowUpRight size={17} aria-hidden="true" /></div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="resource-empty"><Search size={28} aria-hidden="true" /><h2>暂未找到匹配的工具</h2><p>换一个关键词，或选择其他软件。</p><button type="button" className="resource-button" onClick={() => { setQuery(""); setHost("全部"); }}>显示全部工具</button></div>}

      <aside className="resource-note software-install-note"><Monitor size={19} aria-hidden="true" /><div><strong>使用入口：AI Agent + 本地软件</strong><p>当前收录的是我们开发的 Skill 与脚本工具包。下载后按说明安装到 Agent 的 Skill 目录，由 Agent 配合本地软件使用。</p></div></aside>

      <ResourceDialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? "软件工具详情"} eyebrow={selected ? `${selected.host} · Skill 工具包` : undefined} footer={selected && <><a className="resource-button" href={selected.repositoryUrl} target="_blank" rel="noopener noreferrer">GitHub 详情 <ArrowUpRight size={16} aria-hidden="true" /></a><a className="resource-button resource-button--primary" href={selected.downloadUrl} rel="noopener noreferrer">下载 {selected.downloadKind} <Download size={16} aria-hidden="true" /></a></>}>
        {selected && <div className="software-plugin-detail">
          <p className="software-detail-intro">{selected.summary}</p>
          <div className="software-download-meta"><span>{selected.downloadKind}</span><span>版本 {selected.version}</span><span>约 {selected.packageSize}</span></div>
          <DetailList title="能做什么" items={selected.features} />
          <DetailList title="运行环境" items={selected.environment} />
          <DetailList title="如何安装与使用" items={selected.installation} ordered />
          <DetailList title="使用说明" items={selected.boundaries} />
          <p className="resource-meta software-package-provenance">来源：id399-dzx 公开仓库 · 下载版本已于 {selected.verifiedOn} 检查。</p>
        </div>}
      </ResourceDialog>
    </main>
  );
}
