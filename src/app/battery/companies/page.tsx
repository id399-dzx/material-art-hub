import type { Metadata } from 'next';
import Link from 'next/link';
import { companyData, findCompanies } from '@/lib/battery/catalog';

export const metadata: Metadata = { title: '电池企业 · Fesilent 电池资讯' };
export default async function BatteryCompanies({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const text = (key: string) => typeof params[key] === 'string' ? String(params[key]).slice(0, 80) : '';
  const [q, city, region, segment] = ['q', 'city', 'region', 'segment'].map(text);
  const groups = findCompanies(q, city, region, segment);
  const count = new Set(groups.flatMap(group => group.entries.map(entry => entry.company.id))).size;
  return <>
    <header className="battery-hero"><span className="battery-eyebrow">BATTERY INDUSTRY DIRECTORY / 电池产业地域索引</span><h1>电池企业</h1><p>从电芯、电极材料到 BMS，按城市查看企业与产业布局。</p><div className="battery-stats"><span><strong>{companyData.companies.length}</strong>家已核对企业</span><span><strong>{companyData.cities.length}</strong>个城市（含线索）</span><span><strong>{companyData.references.reduce((n, reference) => n + reference.names.length, 0)}</strong>条参考图名单</span><span>核对日期<time>{companyData.updatedAt}</time></span></div></header>
    <form action="/battery/companies" className="battery-panel battery-company-filters" role="search" aria-label="企业目录筛选">
      <label className="battery-search"><span className="sr-only">企业名称或业务关键词</span><input name="q" defaultValue={q} placeholder="搜索企业、材料、BMS…" maxLength={80} /></label>
      <label><span>地区</span><select name="region" defaultValue={region}><option value="">全国地区</option>{[...new Set(companyData.cities.map(city => city.region))].map(region => <option key={region}>{region}</option>)}</select></label>
      <label><span>城市</span><select name="city" defaultValue={city}><option value="">全部城市</option>{companyData.cities.map(city => <option value={city.name} key={city.name}>{city.province} · {city.name}</option>)}</select></label>
      <label><span>业务方向</span><select name="segment" defaultValue={segment}><option value="">全部方向</option>{[...new Set(companyData.companies.flatMap(company => company.segments))].map(segment => <option key={segment}>{segment}</option>)}</select></label>
      <button type="submit">查找企业</button><span className="battery-filter-count">找到 {count} 家企业</span><Link href="/battery/companies">清除筛选</Link>
    </form>
    <p className="battery-note">同一企业可出现在多个城市。未取得当地官方依据的参考图名称单列待核实；地区布局不等于当前招聘岗位。</p>
    {!groups.length && <div className="battery-panel battery-empty"><h2>没有找到匹配的企业</h2><Link href="/battery/companies">清除筛选 →</Link></div>}
    {groups.map(group => <section className="battery-city" key={group.name}>
      <h2>{group.name}<small>{group.province} · {group.region} · {group.entries.length} 家已核对</small></h2>
      <div className="battery-company-grid">{group.entries.map(({ company, location }) => <article className="battery-company-card" key={company.id}>
        <h3>{company.name}</h3><div className="battery-tags">{company.segments.map(segment => <span key={segment}>{segment}</span>)}</div><p>{company.description}</p>
        <footer><span>{group.name} · {location.kind}</span><span>{company.website && <a href={company.website} target="_blank" rel="noopener noreferrer">官网 ↗</a>}<a href={location.source} target="_blank" rel="noopener noreferrer">官方依据 ↗</a></span></footer>
      </article>)}</div>
      {!!group.pending.length && <details className="battery-pending"><summary>参考图待核实名单 · {group.pending.length} 条</summary><p>以下名称的当地企业主体、分部或项目状态尚待官方资料核实。</p><div className="battery-tags">{group.pending.map(name => <span key={name}>{name}</span>)}</div></details>}
    </section>)}
  </>;
}
