"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesCombined, Clock3, Download, FlaskConical, Play, PlayCircle, Search, Sparkles, type LucideIcon } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { ELECTROCHEMISTRY_ARTICLES, ELECTROCHEMISTRY_CATEGORIES, type ElectrochemistryAnimation, type ElectrochemistryArticle } from "@/lib/electrochemistry/catalog";
import "./electrochemistry.css";

const categoryIcons: Record<string, LucideIcon> = {
  basics: BookOpen,
  methods: FlaskConical,
  interpretation: ChartNoAxesCombined,
};
const categoryLabel = (id: string) => ELECTROCHEMISTRY_CATEGORIES.find(category => category.id === id)?.label ?? id;
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase();
const animationCount = ELECTROCHEMISTRY_ARTICLES.reduce((total, article) => total + (article.animations?.length ?? 0), 0);

function articleText(article: ElectrochemistryArticle) {
  return normalize([
    article.title, article.summary, ...article.tags,
    ...(article.animations?.flatMap(animation => [animation.label, animation.keyPoint, animation.caption]) ?? []),
    ...(article.comparison?.rows.flatMap(row => [row.label, ...row.values]) ?? []),
    ...article.sections.flatMap(section => [section.heading, ...section.paragraphs, section.equation ?? ""]),
  ].join(" "));
}

function AnimationViewer({ animations }: { animations: readonly ElectrochemistryAnimation[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = animations[activeIndex];

  return <div className="electrochemistry-viewer">
    <div className="electrochemistry-process-selector">
      <span className="electrochemistry-section-label">对照观看</span>
      <h3>同一界面，两种过程</h3>
      <p>电极如何储存和转移电荷？切换动画，观察两种机制。</p>
      <div className="electrochemistry-process-buttons" role="group" aria-label="切换过程动画">
        {animations.map((animation, index) => <button key={animation.id} type="button" aria-pressed={index === activeIndex} aria-controls="electrochemistry-active-animation" onClick={() => setActiveIndex(index)}>
          <span className="electrochemistry-process-number">0{index + 1}</span>
          <span><strong>{animation.label}</strong><small>{animation.keyPoint}</small></span>
          <PlayCircle size={18} aria-hidden="true" />
        </button>)}
      </div>
      <p className="electrochemistry-viewer-note">每段 {active.durationSeconds} 秒 · 无声动画<br />两种过程可以同时发生，动画分别展示以便观察。</p>
    </div>
    <figure className="electrochemistry-animation" id="electrochemistry-active-animation" aria-label={active.label}>
      <video key={active.src} controls playsInline muted preload="metadata" poster={active.poster} width={1920} height={1080} aria-label={`${active.label}，${active.durationSeconds} 秒无声动画`}>
        <source src={active.src} type="video/mp4" />
        当前浏览器不支持视频播放，请使用下方链接下载 MP4。
      </video>
      <figcaption><strong>{active.label}</strong>{active.caption}</figcaption>
      <div className="electrochemistry-animation-actions">
        <a className="resource-button" href={active.interactiveUrl} target="_blank" rel="noopener noreferrer"><PlayCircle size={15} aria-hidden="true" />打开交互演示<ArrowUpRight size={13} aria-hidden="true" /></a>
        <a className="resource-button" href={active.src} download><Download size={15} aria-hidden="true" />下载本段 MP4</a>
      </div>
      <p className="electrochemistry-animation-mobile-hint">手机观看可打开交互演示，放大查看文字与粒子运动。</p>
    </figure>
  </div>;
}

function AnimationTopicCard({ article, onOpen }: { article: ElectrochemistryArticle; onOpen: () => void }) {
  const animations = article.animations!;
  return <article className="electrochemistry-topic-card">
    <button type="button" className="electrochemistry-topic-cover" onClick={onOpen} aria-label={`观看${article.title}`}>
      <Image src={animations[0].poster} alt="石墨电极与电解液界面的动画预览" width={1920} height={1080} sizes="(max-width: 720px) 100vw, 45vw" />
      <span className="electrochemistry-topic-media-badge">{animations.length} 段对照动画 · 每段 {animations[0].durationSeconds} 秒</span>
      <span className="electrochemistry-topic-play"><Play size={23} fill="currentColor" aria-hidden="true" /></span>
    </button>
    <div className="electrochemistry-topic-copy">
      <span className="electrochemistry-section-label">动画专题 / {categoryLabel(article.category)}</span>
      <h3>{article.title}</h3>
      <p>{article.summary}</p>
      <div className="electrochemistry-topic-processes">{animations.map(animation => <span key={animation.id}><strong>{animation.label}</strong><small>{animation.keyPoint}</small></span>)}</div>
      <div className="electrochemistry-topic-footer"><span><Clock3 size={13} aria-hidden="true" />讲解约 {article.readingMinutes} 分钟</span><button type="button" className="resource-button resource-button--primary" onClick={onOpen}>观看动画与对比讲解<ArrowRight size={15} aria-hidden="true" /></button></div>
    </div>
  </article>;
}

export default function ElectrochemistryLibrary() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ElectrochemistryArticle | null>(null);
  const filtered = useMemo(() => {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    return ELECTROCHEMISTRY_ARTICLES.filter(article => (category === "all" || article.category === category)
      && terms.every(term => articleText(article).includes(term)));
  }, [category, query]);

  function clearFilters() {
    setCategory("all");
    setQuery("");
  }

  return <main className="resource-page electrochemistry-page">
    <section className="resource-hero electrochemistry-hero" aria-labelledby="electrochemistry-heading">
      <div>
        <span className="resource-eyebrow"><Sparkles size={15} aria-hidden="true" /> ELECTROCHEMISTRY / KNOWLEDGE</span>
        <h1 id="electrochemistry-heading">电化学知识</h1>
        <p>从基础概念到常用测试，理解曲线背后的电化学。看动画、读讲解，按主题查找公式、实验问题与参考资料。</p>
      </div>
      <span className="electrochemistry-hero-note"><BookOpen size={17} aria-hidden="true" /> 从概念到数据判读</span>
    </section>

    <div className="electrochemistry-overview" aria-label="电化学知识概览">
      <span><strong>{ELECTROCHEMISTRY_ARTICLES.length}</strong> 个知识主题</span><span><strong>{animationCount}</strong> 段机制动画</span><span>{ELECTROCHEMISTRY_CATEGORIES.length} 类学习方向</span><span>免费开放 · 无需登录</span>
    </div>

    <section className="resource-catalog" aria-labelledby="electrochemistry-catalog-heading">
      <div className="electrochemistry-catalog-heading">
        <div><h2 id="electrochemistry-catalog-heading">从这里开始理解电化学</h2><p>选择一个主题，或搜索你在实验中遇到的问题。</p></div>
        <span className="resource-meta" role="status" aria-live="polite">{filtered.length} 个知识主题</span>
      </div>

      <div className="electrochemistry-toolbar">
        <div className="electrochemistry-categories" role="group" aria-label="按知识主题筛选">
          <button type="button" className="resource-chip" aria-pressed={category === "all"} aria-controls="electrochemistry-articles" onClick={() => setCategory("all")}>全部</button>
          {ELECTROCHEMISTRY_CATEGORIES.map(item => <button key={item.id} type="button" className="resource-chip" aria-pressed={category === item.id} aria-controls="electrochemistry-articles" onClick={() => setCategory(item.id)}>{item.label}</button>)}
        </div>
        <label className="electrochemistry-search">
          <Search size={17} aria-hidden="true" />
          <span className="electrochemistry-sr-only">搜索电化学知识</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索法拉第、CV、阻抗…" aria-controls="electrochemistry-articles" />
        </label>
      </div>

      <div id="electrochemistry-articles">
        {filtered.length ? <div className="resource-grid electrochemistry-grid">
          {filtered.map(article => {
            if (article.animations?.length) return <AnimationTopicCard key={article.id} article={article} onOpen={() => setSelected(article)} />;
            const Icon = categoryIcons[article.category] ?? BookOpen;
            return <article key={article.id} className={`resource-card electrochemistry-card electrochemistry-card--${article.category}`}>
              <div className="electrochemistry-card-top"><span className="resource-card-icon"><Icon size={23} aria-hidden="true" /></span><span className="resource-chip">{categoryLabel(article.category)}</span></div>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
              <div className="electrochemistry-tags">{article.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
              <div className="resource-card-footer"><span className="electrochemistry-reading-time"><Clock3 size={13} aria-hidden="true" />约 {article.readingMinutes} 分钟</span><button type="button" className="electrochemistry-read" onClick={() => setSelected(article)} aria-label={`阅读${article.title}`}>阅读全文<ArrowUpRight size={15} aria-hidden="true" /></button></div>
            </article>;
          })}
        </div> : <div className="resource-empty electrochemistry-empty"><BookOpen size={30} aria-hidden="true" /><h3>没有找到相关知识条目</h3><p>换一个关键词，或清除筛选后浏览全部主题。</p><button type="button" className="resource-button" onClick={clearFilters}>清除筛选</button></div>}
      </div>
    </section>

    {selected && <ResourceDialog open onClose={() => setSelected(null)} title={selected.title} eyebrow={`${categoryLabel(selected.category)} · ${selected.animations ? `${selected.animations.length} 段动画 · 讲解` : "阅读"}约 ${selected.readingMinutes} 分钟`}
      className={selected.animations ? "electrochemistry-topic-dialog" : undefined}
      footer={selected.animations ? undefined : <button type="button" className="resource-button" onClick={() => setSelected(null)}>返回知识库</button>}>
      <article className="electrochemistry-article">
        {selected.animations && <AnimationViewer key={selected.id} animations={selected.animations} />}
        <p className="electrochemistry-article-intro">{selected.summary}</p>
        {selected.comparison && <section className="electrochemistry-comparison" aria-labelledby="electrochemistry-comparison-heading">
          <span className="electrochemistry-section-label">一起理解</span><h3 id="electrochemistry-comparison-heading">两种过程，区别在哪里？</h3>
          <div className="electrochemistry-comparison-scroll" role="region" aria-label="法拉第与非法拉第过程对比表" tabIndex={0}>
            <table><caption className="electrochemistry-sr-only">法拉第与非法拉第过程的机制对比</caption><thead><tr><th scope="col">比较维度</th>{selected.comparison.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
              <tbody>{selected.comparison.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={index}>{value}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="electrochemistry-comparison-note">{selected.comparison.note}</p>
        </section>}
        {!selected.animations && <div className="electrochemistry-tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
        <div className={selected.animations ? "electrochemistry-topic-reading" : undefined}>
          {selected.animations && <span className="electrochemistry-section-label">继续阅读 / 从机制到实验</span>}
          {selected.sections.map(section => <section className="electrochemistry-article-section" key={section.heading}>
            <h3>{section.heading}</h3>
            {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {section.equation && <div className="electrochemistry-equation"><span>关系式</span><code>{section.equation}</code></div>}
          </section>)}
          {selected.sources.length > 0 && <section className="electrochemistry-sources"><h3>参考来源</h3><ol>{selected.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={13} aria-label="在新窗口打开" /></a></li>)}</ol></section>}
        </div>
      </article>
    </ResourceDialog>}
  </main>;
}
