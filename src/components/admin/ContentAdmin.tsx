'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArchiveRestore, ArrowLeft, Loader2, Pencil, RotateCcw, Search, Settings2, Trash2 } from 'lucide-react';
import ResourceDialog from '@/components/resources/ResourceDialog';
import { useContentAdmin } from './ContentProvider';
import { CONTENT_FIELDS, CHOICE_LABELS, JOURNAL_OPTION_FIELDS, isRecord, validateContentPatch } from '@/lib/admin/schema';
import { STATIC_CATALOGS, mergeContentItem } from '@/lib/admin/registry';
import { PLUGIN_ASSET_TAG } from '@/lib/software-plugins/catalog';
import type { AdminAsset, ContentAction, ContentOverride, ContentPatch, ContentSection, StaticSection } from '@/lib/admin/types';
import './admin.css';

const sections: { id: ContentSection; label: string; link: string }[] = [
    { id: 'assets', label: '科研素材', link: '/' }, { id: 'templates', label: '科研图模板', link: '/data-processing' },
    { id: 'skills', label: '科研 Skill', link: '/research-skills' }, { id: 'journals', label: '期刊排版', link: '/paper-formatting' },
    { id: 'plugins', label: '软件插件', link: '/software-plugins' },
];
type Entry = { section: ContentSection; id: string; title: string; summary: string; hidden: boolean; values: ContentPatch; override?: ContentOverride; asset?: AdminAsset };
type Confirmation = { entry: Entry; action: 'hide' | 'reset'; returnToEditor: boolean };
function buildEntries(rows: ContentOverride[], assets: AdminAsset[]): Entry[] {
    const overrides = new Map(rows.map(row => [row.section + '/' + row.item_id, row]));
    const staticEntries = (Object.keys(STATIC_CATALOGS) as StaticSection[]).flatMap(section => STATIC_CATALOGS[section].map(({ id, item }) => {
        const override = overrides.get(section + '/' + id);
        const values = mergeContentItem(item, override?.patch ?? {});
        return { section, id, title: String(values.title ?? values.name ?? id), summary: String(values.summary ?? values.description ?? ''), hidden: override?.hidden ?? false, values, override };
    }));
    const assetEntries: Entry[] = assets.map(asset => {
        const plugin = asset.tags_style?.includes(PLUGIN_ASSET_TAG) ?? false;
        let metadata: ContentPatch = {};
        if (plugin) { try { const value: unknown = JSON.parse(asset.description ?? ''); if (isRecord(value)) metadata = value; } catch {} }
        const values = plugin ? { ...metadata, title: asset.title } : { ...asset, description: asset.description ?? '' };
        return { section: plugin ? 'plugins' : 'assets', id: asset.id, title: asset.title, summary: String(plugin ? metadata.summary ?? '插件介绍暂时不可读取' : asset.description ?? ''), hidden: asset.hidden, values, asset };
    });
    return [...assetEntries, ...staticEntries];
}

export default function ContentAdmin() {
    const searchParams = useSearchParams();
    const { isAdmin, checking, authError, retryAdmin, refreshContent } = useContentAdmin();
    const [rows, setRows] = useState<ContentOverride[]>([]);
    const [assets, setAssets] = useState<AdminAsset[]>([]);
    const [section, setSection] = useState<ContentSection | 'trash'>('assets');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [editing, setEditing] = useState<Entry | null>(null);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [options, setOptions] = useState<ContentPatch>({});
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const revision = useRef(0);
    const requestedHandled = useRef<string | null>(null);
    const entries = useMemo(() => buildEntries(rows, assets), [rows, assets]);
    const visible = useMemo(() => entries.filter(entry => (section === 'trash' ? entry.hidden : !entry.hidden && entry.section === section) && `${entry.title} ${entry.summary} ${entry.id}`.toLowerCase().includes(search.trim().toLowerCase())), [entries, section, search]);
    const load = useCallback(async () => {
        const current = ++revision.current;
        setLoading(true);
        try {
            const response = await fetch('/api/admin/content', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
            const result = await response.json();
            if (!response.ok || !Array.isArray(result.rows) || !Array.isArray(result.assets)) throw new Error(result.error || '管理目录暂时无法读取。');
            if (current === revision.current) { setRows(result.rows); setAssets(result.assets); setLoaded(true); setError(''); }
        } catch (cause) { if (current === revision.current) setError(cause instanceof Error ? cause.message : '管理目录暂时无法读取。'); }
        finally { if (current === revision.current) setLoading(false); }
    }, []);
    const invalidateRead = useCallback(() => { ++revision.current; }, []);
    useEffect(() => {
        if (checking || !isAdmin) return;
        void load();
        return invalidateRead;
    }, [isAdmin, checking, load, invalidateRead]);
    function openEditor(entry: Entry) {
        setDraft(Object.fromEntries(CONTENT_FIELDS[entry.section].map(field => [field.key, field.kind === 'array' ? (Array.isArray(entry.values[field.key]) ? (entry.values[field.key] as string[]).join('\n') : '') : String(entry.values[field.key] ?? '')])));
        setOptions(isRecord(entry.values.options) ? { ...entry.values.options } : {});
        setError(''); setNotice(''); setEditing(entry);
    }
    useEffect(() => {
        const query = searchParams.toString();
        if (!loaded || requestedHandled.current === query) return;
        requestedHandled.current = query;
        const params = searchParams;
        const requestedSection = params.get('section');
        if (sections.some(item => item.id === requestedSection)) setSection(requestedSection as ContentSection);
        const id = params.get('item');
        if (!id) return;
        const entry = entries.find(item => item.id === id && (!requestedSection || item.section === requestedSection));
        if (entry) { setSection(entry.hidden ? 'trash' : entry.section); openEditor(entry); }
        else setError('未找到指定条目，它可能已被移除。请在目录中重新选择。');
    }, [loaded, entries, searchParams]);

    async function mutate(entry: Entry, action: ContentAction, patch: ContentPatch = {}) {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError(''); setNotice('');
        try {
            const response = await fetch('/api/admin/content', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
                body: JSON.stringify({ section: entry.section, itemId: entry.id, action, patch, expectedVersion: entry.asset?.updated_at ?? entry.override?.updated_at ?? null,
                    ...(entry.asset ? { expected: { title: entry.asset.title, description: entry.asset.description, hidden: entry.asset.hidden } } : {}),
                }),
            });
            const result = await response.json();
            if (!response.ok || result.ok !== true) throw new Error(result.error || '保存结果无法确认，请刷新后检查。');
            setEditing(null); setConfirmation(null);
            await load(); await refreshContent();
            setNotice(action === 'hide' ? '已下架，内容和文件保留在回收站。' : action === 'restore' ? '已恢复展示。' : action === 'reset' ? '已恢复代码中原有的介绍与显示状态。' : '已保存，公开页面将使用更新后的内容。');
        } catch (cause) { setError(cause instanceof Error ? cause.message : '保存结果无法确认，请刷新后检查。'); }
        finally { pending.current = false; setBusy(false); }
    }
    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editing || busy) return;
        try {
            const value: ContentPatch = Object.fromEntries(CONTENT_FIELDS[editing.section].map(field => [field.key, field.kind === 'array' ? draft[field.key].split(/\r?\n/).map(item => item.trim()).filter(Boolean) : draft[field.key]]));
            if (editing.section === 'journals') value.options = options;
            const patch = validateContentPatch(editing.section, value);
            void mutate(editing, 'edit', patch);
        } catch (cause) { setError(cause instanceof Error ? cause.message : '请检查填写内容。'); }
    }
    function ask(entry: Entry, action: 'hide' | 'reset') { if (busy) return; const returnToEditor = editing?.id === entry.id && editing?.section === entry.section; setEditing(null); setError(''); setConfirmation({ entry, action, returnToEditor }); }
    function cancelConfirmation() { if (busy) return; if (confirmation?.returnToEditor) setEditing(confirmation.entry); setConfirmation(null); setError(''); }

    if (checking) return <main className="resource-page admin-page"><p className="admin-status" role="status"><Loader2 className="admin-spin" size={18} />正在核验管理员账号…</p></main>;
    if (!isAdmin) return <main className="resource-page admin-page"><div className="resource-catalog admin-access"><Settings2 size={30} /><h1>网站内容管理</h1><p>{authError || '请登录管理员账号后管理网站内容。'}</p>{authError && <button type="button" className="resource-button" onClick={retryAdmin}>重试账号核验</button>}<Link className="resource-button resource-button--primary" href="/login?next=%2Fadmin">登录账号</Link><Link className="resource-button" href="/">返回首页</Link></div></main>;
    return <main className="resource-page admin-page">
        <section className="resource-hero"><div><span className="resource-eyebrow"><Settings2 size={14} /> WEBSITE CONTENT</span><h1>网站内容管理</h1><p>编辑介绍、分类和使用说明；下架的条目可在回收站恢复。</p></div><button type="button" className="resource-button" disabled={loading || busy} onClick={() => { void load(); void refreshContent(); }}><RotateCcw size={16} />重新加载</button></section>
        {error && !editing && !confirmation && <p className="admin-feedback is-error" role="alert">{error}</p>}
        {notice && <p className="admin-feedback" role="status">{notice}</p>}
        <div className="admin-layout"><nav className="admin-nav" aria-label="管理内容分类">{sections.map(item => <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => { setSection(item.id); setSearch(''); }} aria-pressed={section === item.id}><span>{item.label}</span><small>{entries.filter(entry => !entry.hidden && entry.section === item.id).length}</small></button>)}<button type="button" className={section === 'trash' ? 'is-active' : ''} onClick={() => { setSection('trash'); setSearch(''); }} aria-pressed={section === 'trash'}><span><Trash2 size={15} />回收站</span><small>{entries.filter(entry => entry.hidden).length}</small></button></nav>
            <section className="resource-catalog admin-catalog"><div className="admin-catalog-heading"><div><h2>{section === 'trash' ? '回收站' : sections.find(item => item.id === section)?.label}</h2><p>{section === 'trash' ? '恢复条目会保留已有介绍；恢复默认会撤销目录覆盖。' : '修改保存后生效，下架不会删除安装包或素材文件。'}</p></div>{section !== 'trash' && <Link className="resource-button" href={sections.find(item => item.id === section)!.link}><ArrowLeft size={14} />查看公开页面</Link>}</div>
                <label className="admin-search"><Search size={17} /><span className="admin-sr-only">搜索条目</span><input type="search" value={search} onChange={event => setSearch(event.currentTarget.value)} placeholder="搜索名称、简介或编号" /></label>
                {loading && !loaded ? <p className="admin-status" role="status"><Loader2 size={18} className="admin-spin" />正在读取管理目录…</p> : <div className="admin-list">{visible.map(entry => <article key={entry.section + '/' + entry.id} className="admin-card"><div className="admin-card-text"><span className="admin-card-meta">{sections.find(item => item.id === entry.section)?.label}{entry.override && Object.keys(entry.override.patch).length > 0 ? ' · 已自定义' : ''}{entry.hidden ? ' · 已下架' : ''}</span><h3>{entry.title}</h3><p>{entry.summary}</p></div><div className="admin-card-actions"><button type="button" className="resource-button" disabled={busy} onClick={() => openEditor(entry)}><Pencil size={14} />编辑</button>{entry.hidden ? <button type="button" className="resource-button resource-button--primary" disabled={busy} onClick={() => { void mutate(entry, 'restore'); }}><ArchiveRestore size={14} />恢复展示</button> : <button type="button" className="resource-button" disabled={busy} onClick={() => ask(entry, 'hide')}><Trash2 size={14} />下架</button>}{entry.override && (Object.keys(entry.override.patch).length > 0 || entry.hidden) && <button type="button" className="resource-button" disabled={busy} onClick={() => ask(entry, 'reset')}><RotateCcw size={14} />恢复默认</button>}</div></article>)}</div>}
                {loaded && !visible.length && <p className="admin-empty">{section === 'trash' ? '回收站为空。' : '没有找到匹配的条目。'}</p>}
            </section></div>
        <ResourceDialog open={editing !== null} title={'编辑' + (editing ? sections.find(item => item.id === editing.section)?.label : '内容')} eyebrow="CONTENT / EDIT" onClose={() => { if (!busy) { setEditing(null); setError(''); } }}>
            {editing && <form className="admin-editor" onSubmit={save} aria-busy={busy}><p className="admin-editor-intro">{editing.title}{editing.section === 'plugins' ? ' · 此处保存介绍；更换安装包请在软件插件页使用“更新安装包”。' : editing.section === 'templates' ? ' · 模板的绘图结构与示例数据由当前图形引擎维护。' : ''}</p>{error && <p className="admin-feedback is-error" role="alert">{error}</p>}<fieldset disabled={busy}>{CONTENT_FIELDS[editing.section].map(field => <label className="admin-field" key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span>{field.kind === 'select' ? <select value={draft[field.key] ?? ''} onChange={event => { const next = event.currentTarget.value; setDraft(value => ({ ...value, [field.key]: next })); }}>{field.choices?.map(choice => <option key={choice} value={choice}>{CHOICE_LABELS[choice] ?? choice}</option>)}</select> : field.kind === 'date' || field.kind === 'url' ? <input type={field.kind === 'date' ? 'date' : 'url'} value={draft[field.key] ?? ''} required={field.kind === 'date' || !field.optionalUrl} onChange={event => { const next = event.currentTarget.value; setDraft(value => ({ ...value, [field.key]: next })); }} /> : <textarea rows={field.kind === 'array' ? 4 : field.limit && field.limit <= 255 ? 1 : 3} value={draft[field.key] ?? ''} required={field.required} maxLength={field.kind === 'array' ? 40040 : field.limit ?? 4000} onChange={event => { const next = event.currentTarget.value; setDraft(value => ({ ...value, [field.key]: next })); }} />}{field.kind === 'array' && <small>每行一条，最多 40 条。</small>}</label>)}</fieldset>
                {editing.section === 'journals' && <fieldset className="admin-options" disabled={busy}><legend>Word 排版默认参数</legend>{JOURNAL_OPTION_FIELDS.map(field => <label className="admin-field" key={field.key}><span>{field.label}</span>{field.kind === 'boolean' ? <input type="checkbox" checked={options[field.key] === true} onChange={event => { const next = event.currentTarget.checked; setOptions(value => ({ ...value, [field.key]: next })); }} /> : field.kind === 'number' ? <input type="number" required min={field.min} max={field.max} step={field.key === 'fontSize' ? 0.5 : 0.01} value={String(options[field.key] ?? '')} onChange={event => { const next = event.currentTarget.value; setOptions(value => ({ ...value, [field.key]: next === '' ? '' : Number(next) })); }} /> : <select value={String(options[field.key] ?? '')} onChange={event => { const next = event.currentTarget.value; setOptions(value => ({ ...value, [field.key]: field.key === 'lineSpacing' ? Number(next) : next })); }}>{field.choices.map(choice => <option key={choice}>{choice}</option>)}</select>}</label>)}</fieldset>}
                <div className="admin-editor-actions"><button type="button" className="resource-button" disabled={busy} onClick={() => { setEditing(null); setError(''); }}>取消</button>{editing.hidden ? <button type="button" className="resource-button" disabled={busy} onClick={() => { void mutate(editing, 'restore'); }}>恢复展示</button> : <button type="button" className="resource-button" disabled={busy} onClick={() => ask(editing, 'hide')}>下架</button>}<button className="resource-button resource-button--primary" type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="admin-spin" /> : <Pencil size={15} />}{busy ? '正在保存…' : '保存修改'}</button></div></form>}
        </ResourceDialog>
        <ResourceDialog open={confirmation !== null} title={confirmation?.action === 'reset' ? '恢复默认内容' : '确认下架'} eyebrow="CONTENT / CONFIRM" onClose={cancelConfirmation} footer={confirmation && <><button type="button" className="resource-button" disabled={busy} onClick={cancelConfirmation}>取消</button><button type="button" className="resource-button resource-button--primary" disabled={busy} onClick={() => { void mutate(confirmation.entry, confirmation.action); }}>{busy ? '正在保存…' : confirmation.action === 'reset' ? '恢复默认' : '确认下架'}</button></>}>
            {confirmation && <div className="admin-confirm"><h3>{confirmation.entry.title}</h3><p>{confirmation.action === 'reset' ? '将撤销该条目的自定义介绍并恢复展示，使用代码中原有的内容。' : '下架后公开页面将隐藏此条目。介绍和文件继续保留，可从回收站恢复。'}</p>{error && <p className="admin-feedback is-error" role="alert">{error}</p>}</div>}
        </ResourceDialog>
    </main>;
}
