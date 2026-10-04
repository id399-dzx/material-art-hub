'use client';

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Download, FilePlus2, FolderOpen, Grip, ImagePlus, Layers3, LayoutGrid, Loader2, Move, Pencil, Plus, Redo2, Save, SlidersHorizontal, Trash2, Undo2, UploadCloud, X } from 'lucide-react';
import { addAssetToComposition, arrangeComposition, compositionIssues, createComposition, panelLabel, removePanel, renderCompositionSvg, type CompositionDocument, type CompositionPanel, type FigureAsset } from '@/lib/data-processing/figure-composition';
import { downloadComposition, loadComposition, openCompositionFile, readFigureUpload, saveComposition } from '@/lib/data-processing/figure-composition-browser';
import { initialExportSettings } from '@/lib/data-processing/publication';
import PublicationExport from './PublicationExport';
import './figure-composer.css';

export type FigureComposerHandle = { addAsset: (asset: FigureAsset) => Promise<void> };
type Props = { active: boolean; ref?: Ref<FigureComposerHandle>; onEditSource: (asset: FigureAsset) => void };
type ReplaceRequest = { document: CompositionDocument; source: string };
type Drag = { panelId: string; pointerId: number; x: number; y: number; original: CompositionDocument; panel: CompositionPanel; mode: 'move' | 'resize'; changed: boolean };

const layouts: { value: CompositionDocument['layout']; name: string; icon: string; description: string }[] = [
    { value: 'grid', name: '均衡网格', icon: 'grid', description: '等宽分列，完整保留每张图' },
    { value: 'row', name: '横向排列', icon: 'row', description: '单行比较，同一视觉高度' },
    { value: 'column', name: '纵向排列', icon: 'column', description: '逐张竖排，适合连续结果' },
    { value: 'hero-top', name: '上方主图', icon: 'hero-top', description: '第一张为主图，其余在下方排列' },
    { value: 'hero-left', name: '左侧主图', icon: 'hero-left', description: '第一张放在左侧，其余在右侧排列' },
];

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function assetPreview(asset: FigureAsset) { return asset.svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(asset.svg) : asset.dataUrl || ''; }
function rounded(value: number) { return Math.round(value * 10) / 10; }
function NumericField({ label, value, min, max, step = 1, disabled, onCommit }: { label: string; value: number; min: number; max: number; step?: number; disabled: boolean; onCommit: (value: number) => void }) {
    return <label className="composer-field"><span>{label}</span><input key={value} type="number" inputMode="decimal" defaultValue={rounded(value)} min={min} max={max} step={step} disabled={disabled} onBlur={event => {
        const next = Number(event.currentTarget.value);
        if (event.currentTarget.value.trim() && Number.isFinite(next)) {
            const safe = clamp(next, min, max);
            if (safe !== rounded(value)) onCommit(safe);
            event.currentTarget.value = String(rounded(safe));
        }
        else event.currentTarget.value = String(rounded(Number(event.currentTarget.defaultValue)));
    }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}

export default function FigureComposer({ active, ref, onEditSource }: Props) {
    const [document, setDocument] = useState<CompositionDocument>(createComposition);
    const documentRef = useRef(document);
    const [loaded, setLoaded] = useState(false);
    const [ready] = useState(() => {
        let resolve!: () => void;
        const promise = new Promise<void>(done => { resolve = done; });
        return { promise, resolve };
    });
    const [revision, setRevision] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [propertiesOpen, setPropertiesOpen] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [saveState, setSaveState] = useState<'loading' | 'idle' | 'pending' | 'saving' | 'saved' | 'failed'>('loading');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [saveError, setSaveError] = useState('');
    const [replaceRequest, setReplaceRequest] = useState<ReplaceRequest | null>(null);
    const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });
    const history = useRef<{ past: CompositionDocument[]; future: CompositionDocument[] }>({ past: [], future: [] });
    const saveQueue = useRef<Promise<void>>(Promise.resolve());
    const saveSequence = useRef(0);
    const mounted = useRef(false);
    const canvasRef = useRef<HTMLDivElement>(null);
    const uploadRef = useRef<HTMLInputElement>(null);
    const projectRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const drag = useRef<Drag | null>(null);
    const operationBusy = useRef(false);
    const [dragging, setDragging] = useState(false);
    const exportSettings = document.exportSettings ?? { ...initialExportSettings(), preset: 'double' as const, widthMm: 180 };
    const disabled = !loaded || processing || exporting;
    const selectedPanel = document.panels.find(panel => panel.id === selectedId);
    const selectedAsset = document.assets.find(asset => asset.id === selectedPanel?.assetId);
    const selectedIndex = selectedPanel ? document.panels.indexOf(selectedPanel) : -1;
    const svg = useMemo(() => renderCompositionSvg(document), [document]);
    const preview = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), [svg]);
    const issues = useMemo(() => compositionIssues(document, exportSettings.widthMm, exportSettings.dpi), [document, exportSettings.widthMm, exportSettings.dpi]);

    useEffect(() => {
        mounted.current = true;
        let cancelled = false;
        loadComposition().then(saved => {
            if (cancelled) return;
            if (saved) { documentRef.current = saved; setDocument(saved); setSaveState('saved'); setNotice('已恢复这台设备上的组图草稿。'); }
            else setSaveState('idle');
        }).catch(error => {
            if (!cancelled) { setSaveState('failed'); setSaveError(error instanceof Error ? error.message : '草稿读取失败，请打开已下载的工程或创建新组图。'); }
        }).finally(() => { if (!cancelled) { setLoaded(true); ready.resolve(); } });
        return () => { cancelled = true; mounted.current = false; };
    }, [ready]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (replaceRequest && dialog && !dialog.open) dialog.showModal();
        if (!replaceRequest && dialog?.open) dialog.close();
    }, [replaceRequest]);

    function updateHistory() { setHistoryCounts({ undo: history.current.past.length, redo: history.current.future.length }); }
    function apply(next: CompositionDocument, record = true) {
        const previous = documentRef.current;
        if (next === previous) return;
        if (record) { history.current.past = [...history.current.past.slice(-29), previous]; history.current.future = []; updateHistory(); }
        documentRef.current = next;
        setDocument(next);
        setRevision(value => value + 1);
        setSaveState('pending');
        setError('');
    }
    function mutate(change: (document: CompositionDocument) => CompositionDocument) {
        if (disabled) return false;
        try { apply(change(documentRef.current)); return true; } catch (error) { setNotice(''); setError(error instanceof Error ? error.message : '修改失败，请检查设置。'); return false; }
    }
    async function persist(next: CompositionDocument) {
        const sequence = ++saveSequence.current;
        setSaveState('saving');
        const task = saveQueue.current.catch(() => {}).then(() => saveComposition(next));
        saveQueue.current = task;
        try {
            await task;
            if (mounted.current && sequence === saveSequence.current) { setSaveState(documentRef.current === next ? 'saved' : 'pending'); setSaveError(''); }
        } catch (error) {
            if (mounted.current && sequence === saveSequence.current) { setSaveState('failed'); setSaveError(error instanceof Error ? error.message : '当前浏览器无法保存草稿，请下载工程文件备份。'); }
            throw error;
        }
    }
    useEffect(() => {
        if (!loaded || !revision || dragging) return;
        const timer = window.setTimeout(() => { void persist(documentRef.current).catch(() => {}); }, 600);
        return () => window.clearTimeout(timer);
        // revision records every committed edit; the timer always reads the newest document.
    }, [revision, loaded, dragging]);

    useImperativeHandle(ref, () => ({
        async addAsset(asset) {
            await ready.promise;
            if (operationBusy.current) throw new Error('正在处理文件或导出组图，请完成后再添加素材。');
            const next = addAssetToComposition(documentRef.current, asset);
            apply(next);
            const panel = next.panels.find(panel => panel.assetId === asset.id);
            setSelectedId(panel?.id ?? null);
            setNotice('已加入「' + asset.name + '」。可继续添加图片，或选择布局自动排列。');
            await persist(next).catch(() => {});
        },
    }));

    function undo() {
        if (disabled || !history.current.past.length || dragging) return;
        const previous = history.current.past.pop()!;
        history.current.future.push(documentRef.current); apply(previous, false); updateHistory();
    }
    function redo() {
        if (disabled || !history.current.future.length || dragging) return;
        const next = history.current.future.pop()!;
        history.current.past.push(documentRef.current); apply(next, false); updateHistory();
    }
    function arrange(patch: Partial<CompositionDocument> = {}) {
        if (mutate(current => arrangeComposition({ ...current, ...patch, heightMode: patch.height !== undefined ? 'fixed' : patch.heightMode ?? current.heightMode }))) setNotice('已按当前布局重新排列；每张图均保持完整比例。');
    }
    function patchPanel(patch: Partial<CompositionPanel>) {
        if (!selectedId) return;
        mutate(current => ({ ...current, panels: current.panels.map(panel => panel.id === selectedId ? { ...panel, ...patch } : panel) }));
    }
    function sizePanel(dimension: 'width' | 'height', value: number) {
        if (!selectedPanel) return;
        const scale = clamp(value / selectedPanel[dimension], Math.max(24 / selectedPanel.width, 24 / selectedPanel.height), Math.min((document.width - selectedPanel.x) / selectedPanel.width, (document.height - selectedPanel.y) / selectedPanel.height));
        patchPanel({ width: rounded(selectedPanel.width * scale), height: rounded(selectedPanel.height * scale) });
    }
    function orderPanel(offset: -1 | 1) {
        if (!selectedPanel || selectedIndex + offset < 0 || selectedIndex + offset >= document.panels.length) return;
        mutate(current => {
            const panels = [...current.panels];
            [panels[selectedIndex], panels[selectedIndex + offset]] = [panels[selectedIndex + offset], panels[selectedIndex]];
            return arrangeComposition({ ...current, panels });
        });
    }
    async function upload(files: FileList | File[]) {
        if (disabled || !files.length) return;
        operationBusy.current = true; setProcessing(true); setError(''); setNotice('');
        const failed: string[] = [];
        let next = documentRef.current, added = 0;
        for (const file of Array.from(files)) {
            try { const asset = await readFigureUpload(file); next = addAssetToComposition(next, asset); added++; }
            catch (error) { failed.push(file.name + '：' + (error instanceof Error ? error.message : '无法读取图片')); }
        }
        if (added) { apply(next); setSelectedId(next.panels.at(-1)?.id ?? null); setNotice('已添加 ' + added + ' 张图片，可重新排列或继续添加。'); }
        if (failed.length) setError(failed.join('；'));
        operationBusy.current = false; setProcessing(false);
    }
    async function openProject(file?: File) {
        if (disabled || !file) return;
        operationBusy.current = true; setProcessing(true); setError('');
        try {
            const next = await openCompositionFile(file);
            if (documentRef.current.assets.length || documentRef.current.panels.length) setReplaceRequest({ document: next, source: file.name });
            else { apply(next); setSelectedId(null); setNotice('已打开工程「' + next.name + '」。'); }
        } catch (error) { setError(error instanceof Error ? error.message : '组图工程无法打开。'); }
        finally { operationBusy.current = false; setProcessing(false); }
    }
    function newProject() {
        if (disabled) return;
        if (documentRef.current.assets.length || documentRef.current.panels.length) setReplaceRequest({ document: createComposition(), source: '新建空白组图' });
        else { apply(createComposition()); setSelectedId(null); }
    }
    function confirmReplace() {
        if (!replaceRequest || disabled) return;
        apply(replaceRequest.document); setSelectedId(null); setNotice('已切换到「' + replaceRequest.document.name + '」。撤销可恢复刚才的组图。'); setReplaceRequest(null);
    }
    function addFromLibrary(asset: FigureAsset) {
        const existing = document.panels.find(panel => panel.assetId === asset.id);
        if (existing) { setSelectedId(existing.id); return; }
        mutate(current => addAssetToComposition(current, asset));
        setSelectedId(documentRef.current.panels.find(panel => panel.assetId === asset.id)?.id ?? null);
    }
    function beginDrag(event: PointerEvent<HTMLButtonElement>, panel: CompositionPanel, mode: Drag['mode']) {
        if (disabled || event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); setSelectedId(panel.id);
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { panelId: panel.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, original: documentRef.current, panel: { ...panel }, mode, changed: false };
        setDragging(true);
    }
    function continueDrag(event: PointerEvent<HTMLButtonElement>) {
        const action = drag.current, bounds = canvasRef.current?.getBoundingClientRect();
        if (!action || action.pointerId !== event.pointerId || !bounds || !bounds.width || !bounds.height) return;
        const dx = (event.clientX - action.x) / bounds.width * action.original.width;
        const dy = (event.clientY - action.y) / bounds.height * action.original.height;
        if (Math.abs(dx) + Math.abs(dy) < 1) return;
        action.changed = true;
        let patch: Partial<CompositionPanel>;
        if (action.mode === 'move') patch = { x: rounded(clamp(action.panel.x + dx, 0, action.original.width - action.panel.width)), y: rounded(clamp(action.panel.y + dy, 0, action.original.height - action.panel.height)) };
        else {
            const ratio = action.panel.width / action.panel.height;
            const scale = clamp(Math.max((action.panel.width + dx) / action.panel.width, (action.panel.height + dy) / action.panel.height), Math.max(24 / action.panel.width, 24 / action.panel.height), Math.min((action.original.width - action.panel.x) / action.panel.width, (action.original.height - action.panel.y) / action.panel.height));
            patch = { width: rounded(action.panel.width * scale), height: rounded(action.panel.width * scale / ratio) };
        }
        apply({ ...action.original, panels: action.original.panels.map(panel => panel.id === action.panelId ? { ...panel, ...patch } : panel) }, false);
    }
    function endDrag(event: PointerEvent<HTMLButtonElement>, cancel = false) {
        const action = drag.current;
        if (!action || action.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (cancel && action.changed) apply(action.original, false);
        else if (action.changed) { history.current.past = [...history.current.past.slice(-29), action.original]; history.current.future = []; updateHistory(); }
        drag.current = null; setDragging(false);
    }
    function panelKeyboard(event: KeyboardEvent<HTMLButtonElement>, panel: CompositionPanel) {
        if (disabled || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); setSelectedId(panel.id);
        const step = event.shiftKey ? 10 : 1;
        const x = clamp(panel.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), 0, Math.max(0, document.width - panel.width));
        const y = clamp(panel.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0), 0, Math.max(0, document.height - panel.height));
        mutate(current => ({ ...current, panels: current.panels.map(item => item.id === panel.id ? { ...item, x, y } : item) }));
    }
    function shortcuts(event: KeyboardEvent<HTMLElement>) {
        if (!active || disabled || !(event.ctrlKey || event.metaKey)) return;
        const target = event.target as HTMLElement;
        if (target.matches('input,textarea,select,[contenteditable="true"]')) return;
        if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
        if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    }
    const saveText = saveState === 'loading' ? '读取草稿…' : saveState === 'pending' ? '有未保存修改' : saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '草稿已保存' : saveState === 'failed' ? '草稿保存失败' : '草稿保存在本机';

    return <section id="paper-composition" hidden={!active} className="figure-composer" aria-label="论文组图工作区" onKeyDown={shortcuts}>
        <header className="composer-intro">
            <div><span className="composer-eyebrow"><Layers3 size={13} /> FIGURE COMPOSITION</span><p>添加数据图与实验图片，选择布局，再自由调整。</p></div>
            <span className={'composer-save-status ' + (saveState === 'failed' ? 'is-failed' : '')} role="status">{saveState === 'saving' || saveState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : saveState === 'saved' ? <Check size={14} /> : <Save size={14} />}{saveText}</span>
        </header>

        <div className="composer-toolbar">
            <label className="composer-name"><span>工程名称</span><input aria-label="组图工程名称" key={document.name} defaultValue={document.name} maxLength={120} disabled={disabled} onBlur={event => { const name = event.currentTarget.value.trim() || '我的论文组图'; if (name !== document.name) mutate(current => ({ ...current, name })); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
            <div className="composer-history"><button type="button" title="撤销（Ctrl / ⌘ Z）" aria-label="撤销组图操作" disabled={disabled || !historyCounts.undo || dragging} onClick={undo}><Undo2 size={16} /></button><button type="button" title="重做（Ctrl / ⌘ Shift Z）" aria-label="重做组图操作" disabled={disabled || !historyCounts.redo || dragging} onClick={redo}><Redo2 size={16} /></button></div>
            <div className="composer-project-actions">
                <button type="button" disabled={disabled} onClick={newProject}><FilePlus2 size={14} /><span>新建</span></button>
                <button type="button" disabled={disabled} onClick={() => projectRef.current?.click()}><FolderOpen size={14} /><span>打开工程</span></button>
                <button type="button" disabled={disabled} onClick={() => { try { downloadComposition(documentRef.current); setNotice('工程已下载，包含原图与组图设置，可在本页重新打开。'); } catch (error) { setError(error instanceof Error ? error.message : '工程下载失败。'); } }}><Download size={14} /><span>下载工程</span></button>
                <button className="is-primary" type="button" disabled={disabled || saveState === 'saving'} onClick={() => { void persist(documentRef.current).catch(() => {}); }}><Save size={14} /><span>保存草稿</span></button>
            </div>
            <input ref={projectRef} className="composer-file-input" aria-label="打开组图工程文件" type="file" accept=".json,application/json" disabled={disabled} onChange={event => { void openProject(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
        </div>
        {error && <p className="composer-message is-error" role="alert"><X size={14} />{error}</p>}
        {saveError && <p className="composer-message is-error" role="alert">{saveError} 当前编辑仍可继续，请下载工程备份。</p>}
        {notice && <p className="composer-message" role="status">{notice}</p>}

        <div className={'composer-workspace ' + (!propertiesOpen ? 'properties-collapsed' : '')}>
            <aside className="composer-library composer-glass">
                <header className="composer-section-title"><span><ImagePlus size={17} /></span><div><h3>我的素材</h3><p>{document.assets.length} 张素材 · {document.panels.length} 张已上画布</p></div></header>
                <button type="button" className="composer-upload" disabled={disabled} onClick={() => uploadRef.current?.click()} onDragOver={event => { event.preventDefault(); }} onDrop={event => { event.preventDefault(); void upload(event.dataTransfer.files); }}>
                    {processing ? <Loader2 size={25} className="animate-spin" /> : <UploadCloud size={25} />}<strong>{processing ? '正在读取文件…' : '添加实验图片'}</strong><span>PNG · JPG · SVG<br />可多选，或拖入此处</span>
                </button>
                <input ref={uploadRef} className="composer-file-input" type="file" aria-label="上传论文组图图片" accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg" multiple disabled={disabled} onChange={event => { if (event.currentTarget.files) void upload(event.currentTarget.files); event.currentTarget.value = ''; }} />
                {document.assets.length ? <div className="composer-asset-list">{document.assets.map(asset => {
                    const panel = document.panels.find(panel => panel.assetId === asset.id), index = panel ? document.panels.indexOf(panel) : -1;
                    return <div key={asset.id} className={'composer-asset ' + (selectedAsset?.id === asset.id ? 'is-selected' : '')}>
                        <button type="button" disabled={disabled} className="composer-asset-main" onClick={() => addFromLibrary(asset)} aria-label={panel ? '选择子图：' + asset.name : '加入画布：' + asset.name}>
                            {/* Uploaded and generated figures are local data URLs; next/image cannot optimize them. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={assetPreview(asset)} alt="" /><span><strong>{asset.name}</strong><small>{asset.kind === 'upload' ? '实验图片' : asset.kind === 'template' ? '模板绘图' : '数据图表'}{asset.demo ? ' · 示例' : ''}</small></span>
                        </button>
                        <div className="composer-asset-bottom"><span>{panel ? (panelLabel(index, document.labelStyle) || String(index + 1)) + ' · 已加入' : '尚未加入画布'}</span><button type="button" disabled={disabled} title={panel ? '从画布移除，保留素材' : '加入画布'} aria-label={panel ? '从画布移除 ' + asset.name : '加入画布 ' + asset.name} onClick={() => { if (panel) { mutate(current => removePanel(current, panel.id)); if (selectedId === panel.id) setSelectedId(null); } else addFromLibrary(asset); }}>{panel ? <X size={13} /> : <Plus size={13} />}</button><button type="button" disabled={disabled} title="删除素材及其子图，可撤销" aria-label={'删除素材 ' + asset.name} onClick={() => { mutate(current => arrangeComposition({ ...current, assets: current.assets.filter(item => item.id !== asset.id), panels: current.panels.filter(item => item.assetId !== asset.id) })); if (selectedAsset?.id === asset.id) setSelectedId(null); }}><Trash2 size={13} /></button></div>
                    </div>;
                })}</div> : <div className="composer-library-empty"><Layers3 size={21} /><p>先添加图片，或在模板编辑器、图表画布中点击<strong>“加入论文组图”</strong>。</p></div>}
                <p className="composer-library-help">素材与草稿保存在当前浏览器。下载工程可备份或换设备继续编辑。</p>
            </aside>

            <div className="composer-stage-column">
                <div className="composer-stage composer-glass">
                    <header className="composer-stage-heading"><div><span className="composer-eyebrow">YOUR FIGURE</span><h3>组图画布 <small>{document.width} × {document.height}</small></h3></div><button type="button" disabled={disabled} className="composer-properties-toggle" aria-expanded={propertiesOpen} aria-controls="composer-properties" onClick={() => setPropertiesOpen(value => !value)}><SlidersHorizontal size={14} />{propertiesOpen ? '收起设置' : '展开设置'}{propertiesOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}</button></header>
                    <div className="composer-layout-strip" aria-label="自动布局选择">{layouts.map(layout => <button type="button" key={layout.value} disabled={disabled} aria-pressed={document.layout === layout.value} title={layout.description} onClick={() => arrange({ layout: layout.value })}><i className={'composer-layout-icon ' + layout.icon}><b /><b /><b /><b /></i>{layout.name}</button>)}</div>
                    <div className="composer-canvas-surround">
                        <div ref={canvasRef} className={'composer-canvas ' + (dragging ? 'is-dragging' : '')} style={{ aspectRatio: document.width + ' / ' + document.height }} onPointerDown={event => { if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === 'IMG') setSelectedId(null); }}>
                            {/* The preview is isolated as an image; selection handles never enter exported SVG. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="composer-canvas-image" src={preview} alt={'论文组图预览，包含 ' + document.panels.length + ' 张子图'} draggable={false} />
                            {document.panels.map((panel, index) => {
                                const asset = document.assets.find(asset => asset.id === panel.assetId), selected = panel.id === selectedId;
                                const style = { left: panel.x / document.width * 100 + '%', top: panel.y / document.height * 100 + '%', width: panel.width / document.width * 100 + '%', height: panel.height / document.height * 100 + '%' } as CSSProperties;
                                return <div key={panel.id} className={'composer-panel-overlay ' + (selected ? 'is-selected' : '')} style={style}>
                                    <button type="button" disabled={disabled} className="composer-panel-target" aria-label={'选择或移动子图 ' + (panelLabel(index, document.labelStyle) || String(index + 1)) + '：' + (asset?.name || '图片')} aria-pressed={selected} title="拖动移动；方向键微调，Shift + 方向键移动 10 个单位" onClick={() => setSelectedId(panel.id)} onPointerDown={event => beginDrag(event, panel, 'move')} onPointerMove={continueDrag} onPointerUp={event => endDrag(event)} onPointerCancel={event => endDrag(event, true)} onKeyDown={event => panelKeyboard(event, panel)} />
                                    {selected && <button type="button" disabled={disabled} className="composer-resize-handle" aria-label="按比例缩放所选子图" title="拖动按比例缩放，也可在右侧填写尺寸" onPointerDown={event => beginDrag(event, panel, 'resize')} onPointerMove={continueDrag} onPointerUp={event => endDrag(event)} onPointerCancel={event => endDrag(event, true)}><Grip size={12} /></button>}
                                </div>;
                            })}
                            {!document.panels.length && <div className="composer-canvas-empty"><div className="composer-empty-art"><i /><i /><i /><i /><span><Plus size={22} /></span></div><strong>从第一张图开始</strong><p>选择素材加入画布，再用自动布局整理你的研究结果。</p><button type="button" disabled={disabled} onClick={() => uploadRef.current?.click()}><ImagePlus size={15} />添加图片</button></div>}
                        </div>
                    </div>
                    <footer className="composer-canvas-footer"><span><Move size={12} />点击选择 · 拖动移动 · 方向键微调</span><span>预览完整画布 · 导出不包含选择框</span></footer>
                    {selectedPanel && selectedAsset && <div className="composer-selection-bar"><span><strong>{panelLabel(selectedIndex, document.labelStyle) || selectedIndex + 1}</strong>{selectedAsset.name}</span><div><button type="button" disabled={disabled || selectedIndex === 0} title="向前排序并重新排列" aria-label="所选子图向前排序" onClick={() => orderPanel(-1)}><ArrowUp size={14} /></button><button type="button" disabled={disabled || selectedIndex === document.panels.length - 1} title="向后排序并重新排列" aria-label="所选子图向后排序" onClick={() => orderPanel(1)}><ArrowDown size={14} /></button>{selectedAsset.editSnapshot != null && selectedAsset.kind !== 'upload' && <button type="button" disabled={disabled} onClick={() => { try { onEditSource(selectedAsset); } catch (error) { setError(error instanceof Error ? error.message : '无法恢复原图，请重新添加对应数据。'); } }}><Pencil size={13} />编辑原图</button>}<button type="button" disabled={disabled} onClick={() => { mutate(current => removePanel(current, selectedPanel.id)); setSelectedId(null); }}><Trash2 size={13} />移出画布</button></div></div>}
                </div>
                <PublicationExport width={document.width} height={document.height} settings={exportSettings} onChange={exportSettings => mutate(current => ({ ...current, exportSettings }))} getSvg={() => renderCompositionSvg(documentRef.current)} filename={document.name} disabled={disabled || !document.panels.length} extraIssues={issues} onBusy={busy => { operationBusy.current = busy; setExporting(busy); }} revision={revision} />
            </div>

            <aside id="composer-properties" className="composer-properties composer-glass" hidden={!propertiesOpen}>
                <header className="composer-section-title"><span><SlidersHorizontal size={17} /></span><div><h3>排版设置</h3><p>先自动排列，再精细调整</p></div></header>
                <fieldset disabled={disabled}>
                    <legend><LayoutGrid size={14} />画布与布局</legend>
                    <label className="composer-field"><span>画布比例</span><select value="custom" aria-label="画布比例预设" onChange={event => { const [width, height] = event.currentTarget.value.split(':').map(Number); if (width && height) arrange({ width, height }); }}><option value="custom">{document.width} : {document.height} · 当前</option><option value="1200:800">3 : 2 · 常用横版</option><option value="1200:900">4 : 3 · 横版</option><option value="1000:1000">1 : 1 · 方形</option><option value="900:1200">3 : 4 · 竖版</option></select></label>
                    <div className="composer-field-pair"><NumericField label="画布宽度" value={document.width} min={300} max={6000} disabled={disabled} onCommit={width => arrange({ width })} /><NumericField label="画布高度" value={document.height} min={100} max={20000} disabled={disabled} onCommit={height => arrange({ height })} /></div>
                    <label className="composer-auto-height"><input type="checkbox" checked={document.heightMode !== 'fixed'} onChange={event => arrange({ heightMode: event.currentTarget.checked ? 'auto' : 'fixed' })} /><span>高度随内容自动调整</span></label>
                    <label className="composer-field"><span>网格列数</span><select value={document.columns} disabled={disabled || document.layout !== 'grid'} onChange={event => arrange({ columns: Number(event.currentTarget.value) })}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value} 列</option>)}</select></label>
                    <div className="composer-field-pair"><NumericField label="子图间距" value={document.gap} min={0} max={240} disabled={disabled} onCommit={gap => arrange({ gap })} /><NumericField label="画布留白" value={document.margin} min={0} max={300} disabled={disabled} onCommit={margin => arrange({ margin })} /></div>
                    <button type="button" className="composer-arrange" disabled={disabled || !document.panels.length} onClick={() => arrange()}><LayoutGrid size={14} />按当前设置重新排列</button>
                    <p className="composer-help">自动排列会重设位置和尺寸。手动调整不会裁切图片，工程名称不出现在导出图中。</p>
                </fieldset>
                <fieldset disabled={disabled}>
                    <legend>编号与字体</legend>
                    <label className="composer-field"><span>子图编号</span><select value={document.labelStyle} onChange={event => arrange({ labelStyle: event.currentTarget.value as CompositionDocument['labelStyle'] })}><option value="a">a · b · c</option><option value="A">A · B · C</option><option value="(a)">(a) · (b) · (c)</option><option value="1">1 · 2 · 3</option><option value="none">不显示编号</option></select></label>
                    <div className="composer-field-pair"><NumericField label="编号字号" value={document.labelSize} min={8} max={96} disabled={disabled} onCommit={labelSize => arrange({ labelSize })} /><label className="composer-field"><span>标注字体</span><select value={document.fontFamily} onChange={event => mutate(current => ({ ...current, fontFamily: event.currentTarget.value }))}><option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Times New Roman">Times</option><option value="sans-serif">无衬线</option></select></label></div>
                    <p className="composer-help">字号为画布单位，最终物理字号可在导出检查中核对。原图内部字体请在原绘图编辑器调整。</p>
                </fieldset>
                <fieldset disabled={disabled || !selectedPanel}>
                    <legend><Move size={14} />{selectedPanel ? '子图 ' + (panelLabel(selectedIndex, document.labelStyle) || selectedIndex + 1) : '选择一张子图'}</legend>
                    {selectedPanel ? <><div className="composer-field-pair"><NumericField label="左侧位置 X" value={selectedPanel.x} min={0} max={Math.max(0, document.width - selectedPanel.width)} disabled={disabled} onCommit={x => patchPanel({ x })} /><NumericField label="顶部位置 Y" value={selectedPanel.y} min={0} max={Math.max(0, document.height - selectedPanel.height)} disabled={disabled} onCommit={y => patchPanel({ y })} /></div><div className="composer-field-pair"><NumericField label="子图宽度" value={selectedPanel.width} min={24} max={Math.max(24, document.width - selectedPanel.x)} disabled={disabled} onCommit={value => sizePanel('width', value)} /><NumericField label="子图高度" value={selectedPanel.height} min={24} max={Math.max(24, document.height - selectedPanel.y)} disabled={disabled} onCommit={value => sizePanel('height', value)} /></div><p className="composer-help">宽高联动，原图始终按比例完整显示。</p><label className="composer-field"><span>子图图注</span><textarea key={selectedPanel.id + ':' + selectedPanel.caption} defaultValue={selectedPanel.caption} maxLength={1000} placeholder="例如：不同扫描速率下的 CV 曲线" rows={3} onBlur={event => { const caption = event.currentTarget.value.trim(); if (caption !== selectedPanel.caption) mutate(current => arrangeComposition({ ...current, panels: current.panels.map(panel => panel.id === selectedPanel.id ? { ...panel, caption } : panel) })); }} /></label><p className="composer-help">图注显示在该图下方，修改后自动重新排版预留空间。</p>{selectedAsset?.attribution && <p className="composer-attribution">来源说明：{selectedAsset.attribution}</p>}{selectedAsset?.demo && <p className="composer-demo-note">此图包含示例数据，请编辑原图替换后用于论文。</p>}</> : <p className="composer-help">点击画布中的图片，查看位置、尺寸和图注。</p>}
                </fieldset>
            </aside>
        </div>

        <dialog ref={dialogRef} className="composer-dialog" aria-labelledby="composer-replace-title" onCancel={event => { event.preventDefault(); setReplaceRequest(null); }} onClose={() => setReplaceRequest(null)}>
            <h3 id="composer-replace-title">替换当前组图？</h3><p>即将打开「{replaceRequest?.source}」。请先下载当前工程保存备份；替换后也可以用撤销恢复。</p><div><button type="button" onClick={() => setReplaceRequest(null)}>继续编辑当前组图</button><button type="button" disabled={disabled} onClick={() => downloadComposition(documentRef.current)}><Download size={14} />下载当前工程</button><button type="button" className="is-primary" disabled={disabled} onClick={confirmReplace}>替换组图</button></div>
        </dialog>
    </section>;
}
