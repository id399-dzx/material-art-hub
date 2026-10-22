import news from '@/data/battery/news.json';
import directory from '@/data/battery/companies.json';

export const CATEGORIES: Record<string, string> = { 'electrode-materials': '电极材料', bms: 'BMS', 'methods-tools': '方法与开源' };
export const newsItems = news.items;
export const companyData = directory;
export const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
export function findNews(query = '', category = '', selected = false) {
  const q = normalize(query.slice(0, 200));
  return newsItems.filter(item => (!selected || item.selected) && (!category || item.category === category)
    && (!q || normalize([item.title, item.summary, item.reason, item.source, ...item.tags].join(' ')).includes(q)));
}
export function dateLabel(value: string | null) {
  if (!value) return '发表时间待核实';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function findCompanies(query = '', city = '', region = '', segment = '') {
  const q = normalize(query.slice(0, 80));
  return companyData.cities.filter(place => (!city || city === place.name) && (!region || region === place.region)).map(place => {
    const entries = companyData.companies.filter(company => (!segment || company.segments.includes(segment))
      && (!q || normalize([company.name, ...company.aliases, company.description, ...company.segments].join(' ')).includes(q)))
      .flatMap(company => company.locations.filter(location => location.city === place.name).map(location => ({ company, location })));
    const matchedNames = new Set(companyData.companies.flatMap(company => company.locations.filter(location => location.city === place.name)
      .flatMap(location => [company.name, ...company.aliases, ...('photoNames' in location ? location.photoNames : [])])));
    const pending = segment ? [] : (companyData.references.find(reference => reference.city === place.name)?.names ?? [])
      .filter(name => !matchedNames.has(name) && (!q || normalize(name).includes(q)));
    return { ...place, entries, pending };
  }).filter(place => place.entries.length || place.pending.length);
}
