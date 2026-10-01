'use client';

import { useState } from 'react';
import { Download, Loader2, ScanLine } from 'lucide-react';
import { auditSvg, downloadFigureBlob, exportDimensions, physicalSvg, rasterizeFigure, type ExportSettings, type FigureIssue } from '@/lib/data-processing/publication';
import './research-tools.css';

export default function PublicationExport({ width, height, settings, onChange, getSvg, filename, disabled = false, extraIssues = [], onBusy, revision }: { width: number; height: number; settings: ExportSettings; onChange: (settings: ExportSettings) => void; getSvg: () => string | Promise<string>; filename: string; disabled?: boolean; extraIssues?: FigureIssue[]; onBusy?: (busy: boolean) => void; revision?: unknown }) {
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [report, setReport] = useState<{ key: string; issues: FigureIssue[]; revision: unknown } | null>(null);
    const key = JSON.stringify({ width, height, settings, extraIssues });
    const [widthDraft, setWidthDraft] = useState<string | null>(null);
    const dimensions = exportDimensions(width, height, settings);
    async function run(format: 'check' | 'svg' | 'png' | 'pdf') {
        if (busy || disabled) return;
        // Open during the user gesture so print preview is not blocked as a popup.
        const printWindow = format === 'pdf' ? window.open('', '_blank') : null;
        setBusy(true); onBusy?.(true); setError('');
        try {
            const svg = await getSvg(), issues = [...await auditSvg(svg, width, height, settings.widthMm), ...extraIssues];
            setReport({ key, issues, revision });
            const name = (filename.trim() || '科研图表').replace(/[\\/:*?"<>|]/g, '_') + (settings.grayscale ? '-灰度' : '');
            if (format === 'svg') downloadFigureBlob(new Blob([physicalSvg(svg, width, height, settings)], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`);
            if (format === 'png') downloadFigureBlob(await rasterizeFigure(svg, width, height, settings), `${name}.png`);
            if (format === 'pdf') {
                if (!printWindow) throw new Error('打印窗口被浏览器阻止，请允许此网站弹出窗口后重试。');
                const doc = printWindow.document;
                doc.open(); doc.write('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>科研图表 · 存为 PDF</title></head><body></body></html>'); doc.close(); doc.title = name;
                const style = doc.createElement('style'); style.textContent = `@page{size:${dimensions.widthMm}mm ${dimensions.heightMm}mm;margin:0}html,body{margin:0;padding:0}svg{display:block}@media print{.print-help{display:none}}`;
                doc.head.append(style);
                const help = doc.createElement('p'); help.className = 'print-help'; help.textContent = '请选择“存储为 PDF”，关闭页眉页脚，比例设为 100%。'; doc.body.append(help);
                const parsed = new DOMParser().parseFromString(physicalSvg(svg, width, height, settings), 'image/svg+xml'); doc.body.append(doc.importNode(parsed.documentElement, true));
                await doc.fonts.ready;
                await Promise.all([...doc.querySelectorAll('image')].map(image => new Promise<void>(resolve => { const img = new Image(); img.onload = () => resolve(); img.onerror = () => resolve(); img.src = image.getAttribute('href') || image.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''; })));
                printWindow.focus(); printWindow.print();
            }
        } catch (error) { printWindow?.close(); setError(error instanceof Error ? error.message : '检查或导出失败。'); }
        finally { setBusy(false); onBusy?.(false); }
    }
    const stale = !!report && (report.key !== key || report.revision !== revision);
    return <section className="publication-export" aria-label="导出与图形检查">
        <header className="research-tool-heading"><span><ScanLine size={19} /></span><div><small>PUBLICATION EXPORT</small><h3>导出与图形检查</h3><p>按最终物理尺寸导出。预设为常用栏宽，请以目标期刊最新要求为准。</p></div></header>
        <fieldset disabled={busy || disabled} className="publication-fields"><label>输出规格<select aria-label="输出栏宽预设" value={settings.preset} onChange={event => { const preset = event.target.value as ExportSettings['preset']; setWidthDraft(null); onChange({ ...settings, preset, widthMm: preset === 'single' ? 85 : preset === 'double' ? 180 : settings.widthMm }); }}><option value="single">常用单栏 · 85 mm</option><option value="double">常用双栏 · 180 mm</option><option value="custom">自定义宽度</option></select></label><label>宽度 (mm)<input aria-label="导出宽度毫米" type="number" min={40} max={300} step={1} value={widthDraft ?? settings.widthMm} onChange={event => { setWidthDraft(event.target.value); const value = Number(event.target.value); if (Number.isFinite(value) && value >= 40 && value <= 300) onChange({ ...settings, preset: 'custom', widthMm: value }); }} onBlur={() => setWidthDraft(null)} /></label><label>高度 (mm)<output>{dimensions.heightMm.toFixed(2)}<small>保留画布比例</small></output></label><label>PNG 分辨率<select aria-label="PNG 分辨率" value={settings.dpi} onChange={event => onChange({ ...settings, dpi: Number(event.target.value) })}><option value={150}>150 DPI · 预览</option><option value={300}>300 DPI</option><option value={600}>600 DPI</option></select></label></fieldset>
        <div className="publication-meta"><label><input type="checkbox" checked={settings.grayscale} disabled={busy || disabled} onChange={event => onChange({ ...settings, grayscale: event.target.checked })} />导出灰度版本</label><span>PNG：{dimensions.widthPx} × {dimensions.heightPx} px · 写入 DPI 元数据</span></div>
        <div className="publication-actions"><button type="button" disabled={busy || disabled} onClick={() => run('check')}><ScanLine size={14} />检查当前图形</button><button type="button" disabled={busy || disabled} onClick={() => run('pdf')}>打印 / 存为 PDF</button><button type="button" disabled={busy || disabled} onClick={() => run('png')}><Download size={14} />PNG</button><button className="is-primary" type="button" disabled={busy || disabled} onClick={() => run('svg')}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}SVG</button></div>
        <p className="publication-help">每次导出都会重新检查。提示不阻止导出；灰度预览不能代替完整色觉检查。SVG 的可编辑文字依赖打开文件的设备字体。</p>
        {error && <p className="research-error" role="alert">{error}</p>}
        {report && <div className="publication-report" role="status"><strong>{stale ? '图形或导出设置已改变，请重新检查。' : `最近一次检查：${report.issues.filter(issue => issue.level === 'warning').length} 项待核对提示`}</strong>{!stale && <ul>{report.issues.map((issue, index) => <li key={index} className={issue.level}>{issue.message}</li>)}</ul>}</div>}
    </section>;
}
