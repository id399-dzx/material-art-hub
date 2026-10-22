import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, dateLabel, findNews, newsItems } from '@/lib/battery/catalog';

export const metadata: Metadata = { title: 'Fesilent 电池资讯 — 电极材料、BMS、方法与开源', description: '收录电池领域论文、实验方法、开源工具与重要产业进展。' };
export default async function BatteryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.slice(0, 200) : '';
  const category = typeof params.category === 'string' ? params.category : '';
  const selected = params.view === 'selected';
  const items = findNews(q, category, selected);
  return <>
    <header className="battery-hero"><span className="battery-eyebrow">BATTERY RESEARCH LIBRARY / 电池科研资讯</span><h1>从电极材料到 BMS，<br /><em>跟踪值得细读的研究。</em></h1><p>论文、实验方法与开源工具优先，兼收重要产业进展。</p><span className="battery-total">已收录 {newsItems.length} 条公开资讯</span></header>
    <section className="battery-panel">
      <form action="/battery" className="battery-filters" role="search" aria-label="站内资讯检索">
        <label className="battery-search"><span className="sr-only">搜索已收录资讯</span><input name="q" defaultValue={q} placeholder="搜索已收录的论文、BMS、实验方法…" maxLength={200} /></label>
        <label><span className="sr-only">资讯栏目</span><select name="category" defaultValue={category}><option value="">全部栏目</option>{Object.entries(CATEGORIES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        {selected && <input type="hidden" name="view" value="selected" />}
        <button type="submit">查找资讯</button>
      </form>
      <div className="battery-results-heading"><h2>{selected ? '精选资讯' : category ? (CATEGORIES[category] ?? '资讯') : '全部资讯'}</h2><span>{items.length} 条</span>{(q || category || selected) && <Link href="/battery">清除筛选</Link>}</div>
      <div className="battery-feed">{items.map(item => <article className="battery-news-card" key={item.id}>
        <div className="battery-meta"><span>{item.source}</span><time dateTime={item.publishedAt ?? undefined}>{dateLabel(item.publishedAt)}</time>{item.selected && <span className="battery-badge">精选</span>}</div>
        <h3><Link href={`/battery/items/${item.id}`}>{item.title}</Link></h3>
        <p>{item.summary}</p>
        <div className="battery-tags">{item.category && <Link href={`/battery?category=${item.category}`}>{CATEGORIES[item.category]}</Link>}{item.tags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>
        {item.reason && <div className="battery-reason">研究看点：{item.reason}</div>}
      </article>)}</div>
      {!items.length && <div className="battery-empty"><h3>没有找到匹配的资讯</h3><p>试试其他关键词，或清除筛选。</p><Link href="/battery">查看全部资讯 →</Link></div>}
    </section>
  </>;
}
