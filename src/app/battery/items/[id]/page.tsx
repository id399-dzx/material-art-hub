import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CATEGORIES, dateLabel, newsItems } from '@/lib/battery/catalog';

export function generateStaticParams() { return newsItems.map(item => ({ id: item.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = newsItems.find(item => item.id === id);
  return { title: item ? `${item.title} · Fesilent 电池资讯` : '资讯不存在', description: item?.summary ?? undefined };
}
export default async function BatteryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = newsItems.find(item => item.id === id);
  if (!item) notFound();
  return <article className="battery-panel battery-reading">
    <Link className="battery-back" href="/battery">← 返回电池资讯</Link>
    <div className="battery-meta"><span>{item.source}</span><time dateTime={item.publishedAt ?? undefined}>{dateLabel(item.publishedAt)}</time>{item.category && <span>{CATEGORIES[item.category]}</span>}</div>
    <h1>{item.title}</h1><p className="battery-abstract">{item.summary}</p>
    {item.reason && <section className="battery-insight"><h2>研究看点</h2><p>{item.reason}</p></section>}
    <div className="battery-tags">{item.tags.map(tag => <Link href={`/battery?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</Link>)}</div>
    <a className="battery-original" href={item.originalUrl} target="_blank" rel="noopener noreferrer">阅读原文 ↗</a>
    <p className="battery-note">本站提供摘要与原文链接；预印本及其他非同行评议内容请结合原文判断。</p>
  </article>;
}
