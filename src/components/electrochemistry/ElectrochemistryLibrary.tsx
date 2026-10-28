"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, BookOpen, ChartNoAxesCombined, Clock3, Download, FlaskConical, PlayCircle, Search, Sparkles, type LucideIcon } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { ELECTROCHEMISTRY_ARTICLES, ELECTROCHEMISTRY_CATEGORIES, type ElectrochemistryArticle } from "@/lib/electrochemistry/catalog";
import "./electrochemistry.css";

const categoryIcons: Record<string, LucideIcon> = {
  basics: BookOpen,
  methods: FlaskConical,
  interpretation: ChartNoAxesCombined,
};
const categoryLabel = (id: string) => ELECTROCHEMISTRY_CATEGORIES.find(category => category.id === id)?.label ?? id;
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase();

function articleText(article: ElectrochemistryArticle) {
  return normalize([
    article.title, article.summary, ...article.tags,
    ...article.sections.flatMap(section => [section.heading, ...section.paragraphs, section.equation ?? ""]),
  ].join(" "));
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

    <section className="resource-stats" aria-label="电化学知识概览">
      <div className="resource-stat" style={{ "--stat-wash": "#d9ccff" } as CSSProperties}><span>知识条目</span><strong>{ELECTROCHEMISTRY_ARTICLES.length}</strong><small>围绕实验与数据的阅读笔记</small></div>
      <div className="resource-stat" style={{ "--stat-wash": "#bfd8f7" } as CSSProperties}><span>学习主题</span><strong>{ELECTROCHEMISTRY_CATEGORIES.length}</strong><small>基础概念 · 测试方法 · 数据判读</small></div>
      <div className="resource-stat" style={{ "--stat-wash": "#f0d3e7" } as CSSProperties}><span>阅读方式</span><strong>开放阅读</strong><small>无需登录 · 动画演示 · 中文讲解</small></div>
    </section>

    <section className="resource-catalog" aria-labelledby="electrochemistry-catalog-heading">
      <div className="electrochemistry-catalog-heading">
        <div><h2 id="electrochemistry-catalog-heading">从这里开始理解电化学</h2><p>选择一个主题，或搜索你在实验中遇到的问题。</p></div>
        <span className="resource-meta" role="status" aria-live="polite">{filtered.length} 篇知识条目</span>
      </div>

      <div className="electrochemistry-toolbar">
        <div className="electrochemistry-categories" role="group" aria-label="按知识主题筛选">
          <button type="button" className="resource-chip" aria-pressed={category === "all"} aria-controls="electrochemistry-articles" onClick={() => setCategory("all")}>全部</button>
          {ELECTROCHEMISTRY_CATEGORIES.map(item => <button key={item.id} type="button" className="resource-chip" aria-pressed={category === item.id} aria-controls="electrochemistry-articles" onClick={() => setCategory(item.id)}>{item.label}</button>)}
        </div>
        <label className="electrochemistry-search">
          <Search size={17} aria-hidden="true" />
          <span className="electrochemistry-sr-only">搜索电化学知识</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索 CV、阻抗、库仑效率…" aria-controls="electrochemistry-articles" />
        </label>
      </div>

      <div id="electrochemistry-articles">
        {filtered.length ? <div className="resource-grid electrochemistry-grid">
          {filtered.map(article => {
            const Icon = article.animation ? PlayCircle : categoryIcons[article.category] ?? BookOpen;
            return <article key={article.id} className={`resource-card electrochemistry-card electrochemistry-card--${article.category}`}>
              <div className="electrochemistry-card-top"><span className="resource-card-icon"><Icon size={23} aria-hidden="true" /></span>{article.animation && <span className="electrochemistry-animation-badge">{article.animation.durationSeconds} 秒动画</span>}<span className="resource-chip">{categoryLabel(article.category)}</span></div>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
              <div className="electrochemistry-tags">{article.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
              <div className="resource-card-footer"><span className="electrochemistry-reading-time"><Clock3 size={13} aria-hidden="true" />约 {article.readingMinutes} 分钟</span><button type="button" className="electrochemistry-read" onClick={() => setSelected(article)} aria-label={`阅读${article.title}`}>{article.animation ? "看动画与讲解" : "阅读全文"}<ArrowUpRight size={15} aria-hidden="true" /></button></div>
            </article>;
          })}
        </div> : <div className="resource-empty electrochemistry-empty"><BookOpen size={30} aria-hidden="true" /><h3>没有找到相关知识条目</h3><p>换一个关键词，或清除筛选后浏览全部主题。</p><button type="button" className="resource-button" onClick={clearFilters}>清除筛选</button></div>}
      </div>
    </section>

    {selected && <ResourceDialog open onClose={() => setSelected(null)} title={selected.title} eyebrow={`${categoryLabel(selected.category)} · 约 ${selected.readingMinutes} 分钟`}
      footer={<button type="button" className="resource-button" onClick={() => setSelected(null)}>返回知识库</button>}>
      <article className="electrochemistry-article">
        <p className="electrochemistry-article-intro">{selected.summary}</p>
        <div className="electrochemistry-tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        {selected.animation && <figure className="electrochemistry-animation">
          <video key={selected.animation.src} controls playsInline muted preload="metadata" poster={selected.animation.poster} width={1920} height={1080} aria-label={`${selected.title}，${selected.animation.durationSeconds} 秒无声动画`}>
            <source src={selected.animation.src} type="video/mp4" />
            当前浏览器不支持视频播放，请使用下方链接下载 MP4。
          </video>
          <figcaption><span>{selected.animation.durationSeconds} 秒 · 无声动画</span>{selected.animation.caption}<span className="electrochemistry-animation-mobile-hint">手机建议打开交互演示，文字会随屏幕调整。</span></figcaption>
          <div className="electrochemistry-animation-actions">
            <a className="resource-button" href={selected.animation.interactiveUrl} target="_blank" rel="noopener noreferrer"><PlayCircle size={15} aria-hidden="true" />交互演示 · 切换两种过程<ArrowUpRight size={13} aria-hidden="true" /></a>
            <a className="resource-button" href={selected.animation.src} download><Download size={15} aria-hidden="true" />下载 MP4</a>
          </div>
        </figure>}
        {selected.sections.map(section => <section className="electrochemistry-article-section" key={section.heading}>
          <h3>{section.heading}</h3>
          {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {section.equation && <div className="electrochemistry-equation"><span>关系式</span><code>{section.equation}</code></div>}
        </section>)}
        {selected.sources.length > 0 && <section className="electrochemistry-sources"><h3>参考来源</h3><ol>{selected.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={13} aria-label="在新窗口打开" /></a></li>)}</ol></section>}
      </article>
    </ResourceDialog>}
  </main>;
}
