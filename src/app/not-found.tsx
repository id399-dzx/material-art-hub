import Link from "next/link";
import { ArrowLeft, BarChart2, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="site-not-found">
      <section className="site-not-found__card">
        <span className="site-not-found__icon"><FileQuestion size={30} /></span>
        <span className="site-not-found__eyebrow">FESILENT REVERIE / 404</span>
        <h1>没有找到这个页面</h1>
        <p>链接可能已失效。你可以返回素材探索，或打开科研数据工作台继续处理数据。</p>
        <div className="site-not-found__actions">
          <Link href="/"><ArrowLeft size={16} /> 返回首页</Link>
          <Link href="/data-processing"><BarChart2 size={16} /> 数据工作台</Link>
        </div>
      </section>
    </main>
  );
}
