import Link from 'next/link';
import './battery.css';

export default function BatteryLayout({ children }: { children: React.ReactNode }) {
  return <div className="battery-site">
    <aside className="battery-sidebar"><p>FESILENT / 电池资讯</p><nav aria-label="电池资讯导航">
      <Link href="/battery">全部资讯</Link><Link href="/battery?view=selected">精选资讯</Link>
      <Link href="/battery?category=electrode-materials">电极材料</Link><Link href="/battery?category=bms">BMS</Link>
      <Link href="/battery?category=methods-tools">方法与开源</Link><Link href="/battery/companies">电池企业</Link>
    </nav><Link className="battery-workspace" href="/reverie">进入 Fesilent Reverie →</Link></aside>
    <main className="battery-main">{children}</main>
  </div>;
}
