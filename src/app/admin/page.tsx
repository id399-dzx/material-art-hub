import type { Metadata } from 'next';
import { Suspense } from 'react';
import ContentAdmin from '@/components/admin/ContentAdmin';

export const metadata: Metadata = { title: '网站内容管理 · Fesilent Reverie', robots: { index: false, follow: false } };
export default function AdminPage() { return <Suspense fallback={<main className="resource-page">正在读取管理目录…</main>}><ContentAdmin /></Suspense>; }
