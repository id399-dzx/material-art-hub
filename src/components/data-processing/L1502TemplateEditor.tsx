"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as XLSX from "xlsx";
import { ChartNoAxesCombined, Code2, Download, FileSpreadsheet, FlaskConical, Layers3, Loader2, Palette, UploadCloud } from "lucide-react";
import type { DrawingTemplate } from "@/lib/data-processing/drawing-catalog";
import { matrixToCsv, numericCell, parseTemplateTable } from "@/lib/data-processing/templates";
import { readWorkbook } from "@/lib/data-processing/read-workbook";
import { buildL1502Data, l1502Roles, suggestL1502Mapping } from "@/lib/data-processing/l1502-data";
import { createL1502Option } from "@/lib/data-processing/l1502-render";
import { L1502_ROLE_LABELS, L1502_SPATIAL_KINDS, l1502DefaultLayout, l1502DefaultStyle, type L1502Mapping, type L1502Style } from "@/lib/data-processing/l1502-spec";
import { validateL1502EditSnapshot, type L1502EditSnapshot, type L1502Source } from "@/lib/data-processing/l1502-edit-snapshot";
import { downloadFigureBlob, initialExportSettings } from "@/lib/data-processing/publication";
import { prepareChartSvg, type FigureAsset } from "@/lib/data-processing/figure-composition";
import PublicationExport from "./PublicationExport";
import TemplateEditorDialog from "./TemplateEditorDialog";
import ChartCodePlayground from "./ChartCodePlayground";
import { canExportChartCode } from "@/lib/data-processing/chart-code-export";
import L1502MatlabSource from "./L1502MatlabSource";
import ChartPalettePicker from "./ChartPalettePicker";
import ScalarPalettePicker from "./ScalarPalettePicker";
import PaletteComparison from "./PaletteComparison";
import { findChartPalette, getChartPalette, getChartValueColors, type ChartPaletteId } from "@/lib/data-processing/chart-palettes";
import { originalL1502Colors } from "@/lib/data-processing/original-chart-colors";
import { appearanceCapabilities, withoutSeriesColors } from "@/lib/data-processing/series-appearance";
import SeriesAppearanceEditor from "./SeriesAppearanceEditor";

function initialEditor(template: DrawingTemplate): L1502EditSnapshot {
    const spec = template.l1502!;
    const source: L1502Source = { name: `${template.name}示例`, kind: "demo", sheets: [{ name: "示例数据", matrix: template.demo }] };
    const table = parseTemplateTable(template.demo, true);
    const mapping = suggestL1502Mapping(table, spec);
    const layout = l1502DefaultLayout(spec);
    const style = { ...l1502DefaultStyle(template.name, layout.width, layout.height, spec), ...originalL1502Colors(template.category), fontSize: 8, xLabel: template.xLabel, yLabel: template.yLabel,
        annotationText: spec.annotation === "formula" ? "Δy = y₂ − y₁" : "参考位置",
        annotationX: numericCell(table.rows[Math.floor(table.rows.length / 2)]?.[mapping.x]) ?? 0 };
    return { kind: "l1502", version: 1, presetId: template.id, source, sheetIndex: 0, hasHeader: true, mapping, style,
        logX: !!spec.logX, logY: !!spec.logY, caption: "", exportSettings: { ...initialExportSettings(), widthMm: layout.widthMm, preset: layout.widthMm === 180 ? "double" : "single" } };
}

export default function L1502TemplateEditor({ template, templateNumber, open, initialSnapshot, assetId, onClose, onAddToComposition }: {
    template: DrawingTemplate; templateNumber?: number; open: boolean; initialSnapshot?: L1502EditSnapshot; assetId?: string | null;
    onClose: (snapshot: L1502EditSnapshot) => void; onAddToComposition?: (asset: FigureAsset) => void | Promise<void>;
}) {
    const [editor, setEditor] = useState<L1502EditSnapshot>(() => initialSnapshot ?? initialEditor(template));
    const [busy, setBusy] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"editor" | "matlab">("editor");
    const [actualPreview, setActualPreview] = useState(false);
    const [comparePalettes, setComparePalettes] = useState(false);
    const [codeEditorOpen, setCodeEditorOpen] = useState(false);
    const tabId = useId();
    const chartRef = useRef<ReactECharts>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [previewWidth, setPreviewWidth] = useState(760);
    const [previewHeight, setPreviewHeight] = useState<number | null>(null);
    useEffect(() => {
        previewRef.current?.closest<HTMLElement>(".template-dialog-content")?.scrollTo({ top: 0, left: 0 });
    }, [activeTab]);
    useEffect(() => {
        if (!open || !previewRef.current) return;
        const measure = () => {
            const canvas = previewRef.current;
            if (!canvas || !canvas.clientWidth || !canvas.clientHeight) return;
            // The chart has its own fixed viewport. Parameter scrolling never
            // changes this size, and only this on-screen preview is scaled.
            setPreviewWidth(Math.max(1, canvas.clientWidth - 20));
            setPreviewHeight(Math.max(1, canvas.clientHeight - 32));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(previewRef.current);
        const dialogContent = previewRef.current.closest<HTMLElement>(".template-dialog-content");
        if (dialogContent) observer.observe(dialogContent);
        measure();
        return () => observer.disconnect();
    }, [open, activeTab]);
    const previewScale = actualPreview ? 1 : Math.min(1, previewWidth / editor.style.width, previewHeight === null ? 1 : previewHeight / editor.style.height);
    const spec = useMemo(() => ({ ...template.l1502!, logX: editor.logX, logY: editor.logY }), [template, editor.logX, editor.logY]);
    const table = useMemo(() => parseTemplateTable(editor.source.sheets[editor.sheetIndex]?.matrix ?? [], editor.hasHeader), [editor.source, editor.sheetIndex, editor.hasHeader]);
    const result = useMemo(() => buildL1502Data(table, editor.mapping, spec), [table, editor.mapping, spec]);
    const originalColors = useMemo(() => originalL1502Colors(template.category), [template.category]);
    const rendered = useMemo(() => {
        if (!result.data) return { option: null, error: "" };
        try {
            return { option: createL1502Option(result.data, spec, { ...editor.style,
                title: `${editor.style.title}${editor.source.kind === "demo" ? " · 示例数据" : ""}`,
                fontSize: editor.style.fontSize * 25.4 / 72 * editor.style.width / editor.exportSettings.widthMm }), error: "" };
        } catch (cause) { return { option: null, error: cause instanceof Error ? cause.message : "请检查数据和绘图参数。" }; }
    }, [result.data, spec, editor.style, editor.source.kind, editor.exportSettings.widthMm]);
    const seriesControls = useMemo(() => rendered.option ? appearanceCapabilities(rendered.option) : [], [rendered.option]);
    const originalOption = useMemo(() => {
        if (!result.data || !originalColors) return null;
        try {
            return createL1502Option(result.data, spec, { ...editor.style, ...originalColors, seriesAppearances: withoutSeriesColors(editor.style.seriesAppearances),
                title: `${editor.style.title}${editor.source.kind === "demo" ? " · 示例数据" : ""}`,
                fontSize: editor.style.fontSize * 25.4 / 72 * editor.style.width / editor.exportSettings.widthMm });
        } catch { return null; }
    }, [result.data, spec, editor.style, editor.source.kind, editor.exportSettings.widthMm, originalColors]);
    const originalScalarOption = useMemo(() => {
        if (!result.data || !originalColors) return null;
        try {
            return createL1502Option(result.data, spec, { ...editor.style,
                scalarPalette: undefined, scalarColors: originalColors.scalarColors, scalarConstantColor: originalColors.scalarConstantColor,
                title: `${editor.style.title}${editor.source.kind === "demo" ? " · 示例数据" : ""}`,
                fontSize: editor.style.fontSize * 25.4 / 72 * editor.style.width / editor.exportSettings.widthMm });
        } catch { return null; }
    }, [result.data, spec, editor.style, editor.source.kind, editor.exportSettings.widthMm, originalColors]);
    const palettePreview = useMemo(() => ({ width: editor.style.width, height: editor.style.height, revision: JSON.stringify([result.data, spec, editor.style, editor.source.kind, editor.exportSettings.widthMm]),
        createOption: (id: ChartPaletteId) => result.data ? createL1502Option(result.data, spec, { ...editor.style,
            seriesAppearances: withoutSeriesColors(editor.style.seriesAppearances),
            scalarColors: editor.style.scalarPalette ? editor.style.scalarColors : getChartValueColors(editor.style),
            colors: [...getChartPalette(id).colors], title: `${editor.style.title}${editor.source.kind === "demo" ? " · 示例数据" : ""}`,
            fontSize: editor.style.fontSize * 25.4 / 72 * editor.style.width / editor.exportSettings.widthMm }) : null,
    }), [result.data, spec, editor.style, editor.source.kind, editor.exportSettings.widthMm]);
    const scalarPreview = useMemo(() => ({ width: editor.style.width, height: editor.style.height, revision: JSON.stringify([result.data, spec, editor.style, editor.source.kind, editor.exportSettings.widthMm]),
        createOption: (scalarPalette: NonNullable<L1502Style["scalarPalette"]>) => result.data ? createL1502Option(result.data, spec, { ...editor.style,
            scalarPalette, title: `${editor.style.title}${editor.source.kind === "demo" ? " · 示例数据" : ""}`,
            fontSize: editor.style.fontSize * 25.4 / 72 * editor.style.width / editor.exportSettings.widthMm }) : null,
    }), [result.data, spec, editor.style, editor.source.kind, editor.exportSettings.widthMm]);
    const scalarOnly = ["heatmap", "bubble-matrix", "histogram2", "contour", "surface", "tri-surface", "implicit-surface"].includes(spec.kind);
    const hasScalar = scalarOnly || !!spec.colorByValue || editor.mapping.color !== undefined;
    const roles = l1502Roles(spec), spatial = L1502_SPATIAL_KINDS.includes(spec.kind);
    const hasErrors = ["error-bar", "error-line"].includes(spec.kind), hasBounds = ["confidence", "error-line"].includes(spec.kind);
    const textFields: { key: keyof L1502Style; name: string }[] = [
        { key: "title", name: "图表标题" }, { key: "xLabel", name: "X 轴 / 类别名称" }, { key: "yLabel", name: "Y 轴名称" },
        ...(spatial ? [{ key: "zLabel" as const, name: "Z 轴名称" }] : []),
        ...(spec.kind === "dual-axis" ? [{ key: "secondaryYLabel" as const, name: "右轴名称" }] : []),
    ];
    function changeStyle<K extends keyof L1502Style>(key: K, value: L1502Style[K]) {
        setEditor(current => ({ ...current, style: { ...current.style, [key]: value } })); setError("");
    }
    function changePalette(id: ChartPaletteId) {
        setEditor(current => ({ ...current, style: { ...current.style,
            scalarColors: current.style.scalarPalette ? current.style.scalarColors : getChartValueColors(current.style),
            seriesAppearances: withoutSeriesColors(current.style.seriesAppearances),
            colors: [...getChartPalette(id).colors] } }));
        setError("");
    }
    function restoreOriginalColors() {
        if (!originalColors) return;
        setEditor(current => ({ ...current, style: { ...current.style, ...originalColors, seriesAppearances: withoutSeriesColors(current.style.seriesAppearances) } }));
        setError("");
    }
    function restoreOriginalScale() {
        if (!originalColors) return;
        setEditor(current => ({ ...current, style: { ...current.style, scalarPalette: undefined,
            scalarColors: [...originalColors.scalarColors], scalarConstantColor: originalColors.scalarConstantColor } }));
        setError("");
    }
    function changeMapping(update: Partial<L1502Mapping>) {
        setEditor(current => ({ ...current, mapping: { ...current.mapping, ...update } })); setError("");
    }
    function bind(source: L1502Source, sheetIndex = 0, hasHeader = true) {
        const next = parseTemplateTable(source.sheets[sheetIndex]?.matrix ?? [], hasHeader);
        const mapping = suggestL1502Mapping(next, spec);
        setEditor(current => ({ ...current, source, sheetIndex, hasHeader, mapping, style: { ...current.style,
            title: source.kind === "file" ? source.name.replace(/\.[^.]+$/, "") : template.name,
            xLabel: source.kind === "file" ? next.columns[mapping.x] || template.xLabel : template.xLabel,
            yLabel: source.kind === "file" ? next.columns[mapping.ys[0]] || template.yLabel : template.yLabel,
            zLabel: next.columns[mapping.z ?? -1] || "Z", secondaryYLabel: next.columns[mapping.ys[1]] || "右轴指标",
            annotationX: numericCell(next.rows[Math.floor(next.rows.length / 2)]?.[mapping.x]) ?? 0 } }));
        setError("");
    }
    async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { setError("请上传 CSV、XLSX 或 XLS 表格。"); return; }
        if (file.size > 10 * 1024 * 1024) { setError("请上传不超过 10 MB 的数据文件。"); return; }
        setBusy(true); setError("");
        try {
            const workbook = readWorkbook(await file.arrayBuffer(), file.name);
            const sheets = workbook.SheetNames.map(name => ({ name, matrix: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: null, blankrows: true }) }));
            const first = sheets.findIndex(sheet => parseTemplateTable(sheet.matrix, false).rows.length > 0);
            if (first < 0) throw new Error("文件中没有可读取的数据行。");
            bind({ name: file.name, kind: "file", sheets }, first, true);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "文件读取失败。"); }
        finally { setBusy(false); }
    }
    function getSvg() {
        if (!rendered.option || !chartRef.current) throw new Error("请先完成数据绑定，生成有效图表。");
        const svg = chartRef.current.getEchartsInstance().renderToSVGString();
        const desc = `L1502 第 ${spec.issue} 期；图式独立重建；${editor.source.kind === "demo" ? "示例数据" : `数据：${editor.source.name}`}；${editor.caption}`;
        return svg.replace(/(<svg\b[^>]*>)/, root => `${root}<desc>${desc.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</desc>`);
    }
    async function addToComposition() {
        if (!onAddToComposition || busy || exporting) return;
        setBusy(true); setError("");
        try {
            const snapshot = validateL1502EditSnapshot(editor);
            await onAddToComposition({ id: assetId ?? crypto.randomUUID(), kind: "template", name: editor.style.title.trim() || template.name,
                width: editor.style.width, height: editor.style.height, svg: prepareChartSvg(getSvg()), caption: editor.caption,
                demo: editor.source.kind === "demo", attribution: `L1502 第 ${spec.issue} 期；图式独立重建`, editSnapshot: snapshot });
            onClose(snapshot);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "加入论文组图失败。"); }
        finally { setBusy(false); }
    }
    const columns = table.columns.map((name, index) => <option key={index} value={index}>{name}</option>);
    const locked = busy || exporting;
    return <><TemplateEditorDialog open={open && !codeEditorOpen} title={template.name} eyebrow={templateNumber === undefined ? "归档模板 / 单图编辑" : `模板 ${String(templateNumber).padStart(3, "0")} / 单图编辑`} description={`${template.category} · 导入表格、选择字段，生成你自己的数据图。`} busy={locked} contentClassName="l1502-dialog-content" onClose={() => onClose(editor)}>
        <div className="l1502-dialog-tabs" role="tablist" aria-label="图例详情">
            {([{ key: "editor", label: "图表编辑", icon: ChartNoAxesCombined }, { key: "matlab", label: "MATLAB 代码", icon: Code2 }] as const).map(tab => <button key={tab.key} id={`${tabId}-${tab.key}-tab`} type="button" role="tab" aria-selected={activeTab === tab.key} aria-controls={`${tabId}-${tab.key}-panel`} tabIndex={activeTab === tab.key ? 0 : -1} disabled={locked} onClick={() => setActiveTab(tab.key)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "editor" : event.key === "End" ? "matlab" : activeTab === "editor" ? "matlab" : "editor"; setActiveTab(next); document.getElementById(`${tabId}-${next}-tab`)?.focus(); } }}><tab.icon size={16} />{tab.label}</button>)}
            <span>编辑即时保留，切换不丢失</span>
        </div>
        <div id={`${tabId}-editor-panel`} className="l1502-edit-panel" role="tabpanel" aria-labelledby={`${tabId}-editor-tab`} hidden={activeTab !== "editor"}>
        <div className="template-editor l1502-editor">
            <section id={`${tabId}-parameters`} className="template-input-panel template-glass" aria-label="模板数据与字段">
                <div className="template-section-heading"><span className="template-section-icon"><FileSpreadsheet size={18} /></span><div><h3>数据与参数</h3><p>导入表格后，字段会自动匹配。</p></div></div>
                <details className="l1502-control-section l1502-guide-section"><summary>图例说明与数据要求</summary><div><p>{template.description}</p><p><strong>数据结构：</strong>{template.requirement}</p><p>{template.guide}</p><p className="l1502-folder-note">来源：L1502 第 {spec.issue} 期 · {spec.folder}</p></div></details>
                <label className={`template-upload${busy ? " is-loading" : ""}`} htmlFor="l1502-data-upload"><input id="l1502-data-upload" className="sr-only" type="file" accept=".csv,.xlsx,.xls" disabled={locked} onChange={importFile} />{busy ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}<strong>导入自己的实验数据</strong><span>CSV / Excel · 最大 10 MB</span></label>
                <div className="template-example-actions"><button type="button" disabled={locked} onClick={() => bind(initialEditor(template).source)}><FlaskConical size={14} />载入示例</button><button type="button" disabled={locked} onClick={() => downloadFigureBlob(new Blob(["\uFEFF", matrixToCsv(template.demo)], { type: "text/csv;charset=utf-8" }), `${template.name}-示例.csv`)}><Download size={14} />下载数据结构</button></div>
                <div className="template-file-meta"><strong>{editor.source.name}</strong><span>{table.rows.length} 行 · {table.columns.length} 列 · {editor.source.kind === "demo" ? "示例数据" : "已上传数据"}</span></div>
                <details className="l1502-control-section" open><summary>字段匹配<span>{editor.mapping.ys.length} 个数值字段</span></summary><div>
                <fieldset className="l1502-fieldset" disabled={locked}>
                    <label className="template-field">工作表<select aria-label="工作表" value={editor.sheetIndex} onChange={event => bind(editor.source, Number(event.target.value), editor.hasHeader)}>{editor.source.sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}</option>)}</select></label>
                    <label className="template-checkbox"><input type="checkbox" checked={editor.hasHeader} onChange={event => bind(editor.source, editor.sheetIndex, event.target.checked)} />首行为表头</label>
                    <label className="template-field">X / 类别 / 来源列<select aria-label="X 列" value={editor.mapping.x} onChange={event => changeMapping({ x: Number(event.target.value) })}>{columns}</select></label>
                    <div className="template-field"><span>Y / 数值 / 目标列</span><div className="l1502-series-fields">{table.columns.map((name, index) => <label key={index}><input type="checkbox" checked={editor.mapping.ys.includes(index)} onChange={() => changeMapping({ ys: editor.mapping.ys.includes(index) ? editor.mapping.ys.filter(y => y !== index) : [...editor.mapping.ys, index] })} />{name}</label>)}</div></div>
                    {roles.map(role => <label className="template-field" key={role}>{L1502_ROLE_LABELS[role]}列<select aria-label={`${L1502_ROLE_LABELS[role]}列`} value={editor.mapping[role] ?? ""} onChange={event => changeMapping({ [role]: event.target.value === "" ? undefined : Number(event.target.value) })}><option value="">不绑定</option>{columns}</select></label>)}
                    {(hasErrors || hasBounds) && editor.mapping.ys.map(y => <div className="l1502-uncertainty" key={y}><strong>{table.columns[y]} · {hasErrors ? "误差" : "区间"}</strong>
                        {hasErrors && <label className="template-field">误差值列<select aria-label={`${table.columns[y]}误差列`} value={editor.mapping.errors[y] ?? ""} onChange={event => { const errors = { ...editor.mapping.errors }; if (event.target.value === "") delete errors[y]; else errors[y] = Number(event.target.value); changeMapping({ errors }); }}><option value="">请选择</option>{columns}</select></label>}
                        {hasBounds && ["lower", "upper"].map(side => <label className="template-field" key={side}>{side === "lower" ? "下界" : "上界"}列<select aria-label={`${table.columns[y]}${side === "lower" ? "下界" : "上界"}列`} value={editor.mapping.bounds[y]?.[side as "lower" | "upper"] ?? ""} onChange={event => { const bounds = { ...editor.mapping.bounds }; if (event.target.value === "") delete bounds[y]; else bounds[y] = { ...bounds[y], lower: bounds[y]?.lower ?? -1, upper: bounds[y]?.upper ?? -1, [side]: Number(event.target.value) }; changeMapping({ bounds }); }}><option value="">{spec.kind === "error-line" ? "可选" : "请选择"}</option>{columns}</select></label>)}
                    </div>)}
                </fieldset>
                </div></details>
                <details className="template-data-details"><summary>查看当前表格（前 6 行）</summary><div className="template-table-wrap"><table><thead><tr>{table.columns.map((name, i) => <th key={i}>{name}</th>)}</tr></thead><tbody>{table.rows.slice(0, 6).map((row, i) => <tr key={i}>{table.columns.map((_, j) => <td key={j}>{String(row[j] ?? "")}</td>)}</tr>)}</tbody></table></div></details>
                {error && <p className="template-notice template-notice--error" role="alert">{error}</p>}
                {(result.error || rendered.error) && <p className="template-notice template-notice--error" role="alert">{result.error || rendered.error}</p>}
                {!!result.data?.warnings.length && <div className="template-notice" role="status"><strong>请核对数据</strong><ul>{result.data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
                <details className="l1502-control-section l1502-style-section"><summary><span className="l1502-summary-title"><Palette size={15} />样式与标注</span><span>字号 · 画布 · 图注</span></summary><div>
                <fieldset className="template-style-fields l1502-fieldset" disabled={locked}>
                    {textFields.map(field => <label className="template-field" key={field.key}>{field.name}<input aria-label={field.name} value={String(editor.style[field.key])} onChange={event => changeStyle(field.key, event.target.value as never)} /></label>)}
                    {seriesControls.length > 0 && <SeriesAppearanceEditor series={seriesControls} value={editor.style.seriesAppearances} onChange={next => changeStyle("seriesAppearances", next)} disabled={locked} />}
                    {!scalarOnly && <ChartPalettePicker value={findChartPalette(editor.style.colors)?.id ?? null} currentColors={editor.style.colors} preview={palettePreview} disabled={locked} onChange={changePalette} extraPalette={originalColors ? { name: "初始配色", description: "恢复此图式最初的系列颜色", colors: originalColors.colors, option: originalOption, selected: JSON.stringify(editor.style.colors) === JSON.stringify(originalColors.colors), onSelect: restoreOriginalColors } : undefined} />}
                    {hasScalar && <ScalarPalettePicker value={editor.style.scalarPalette} preview={scalarPreview} disabled={locked} onChange={id => changeStyle("scalarPalette", id)} extraPalette={originalColors ? { name: "初始色阶", description: "恢复此图式最初的数值渐变", colors: originalColors.scalarColors, option: originalScalarOption, selected: !editor.style.scalarPalette && JSON.stringify(editor.style.scalarColors) === JSON.stringify(originalColors.scalarColors), onSelect: restoreOriginalScale } : undefined} />}
                    <label className="template-field">字体<select aria-label="图表字体" value={editor.style.fontFamily} onChange={event => changeStyle("fontFamily", event.target.value)}><option>Arial</option><option>Times New Roman</option><option>sans-serif</option></select></label>
                    <label className="template-field">主体字号 (pt)<input aria-label="主体字号" type="number" min={5} max={16} step={0.5} value={editor.style.fontSize} onChange={event => { const value = Number(event.target.value); if (value >= 5 && value <= 16) changeStyle("fontSize", value); }} /></label>
                    <label className="template-field">画布宽度 (px)<input aria-label="画布宽度" type="number" min={420} max={1600} value={editor.style.width} onChange={event => { const value = Number(event.target.value); if (value >= 420 && value <= 1600) changeStyle("width", value); }} /></label>
                    <label className="template-field">画布高度 (px)<input aria-label="画布高度" type="number" min={320} max={1000} value={editor.style.height} onChange={event => { const value = Number(event.target.value); if (value >= 320 && value <= 1000) changeStyle("height", value); }} /></label>
                    {spatial && <><label className="template-field">水平视角<input aria-label="水平视角" type="range" min={-180} max={180} value={editor.style.yaw} onChange={event => changeStyle("yaw", Number(event.target.value))} /></label><label className="template-field">俯仰视角<input aria-label="俯仰视角" type="range" min={-80} max={80} value={editor.style.pitch} onChange={event => changeStyle("pitch", Number(event.target.value))} /></label></>}
                    {["histogram", "histogram2", "polar-histogram", "scatter-marginal"].includes(spec.kind) && <label className="template-field">分箱数量<input aria-label="分箱数量" type="number" min={2} max={60} value={editor.style.bins} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 2 && value <= 60) changeStyle("bins", value); }} /></label>}
                    {spec.kind === "implicit-surface" && <label className="template-field">等值面数值<input aria-label="等值面数值" type="number" step="any" value={editor.style.isoLevel} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) changeStyle("isoLevel", value); }} /></label>}
                    {hasBounds && <label className="template-field">区间图例名称<input aria-label="区间图例名称" value={editor.style.intervalLabel} onChange={event => changeStyle("intervalLabel", event.target.value)} /></label>}
                    {(spec.annotation === "line" || spec.annotation === "band" || spec.kind === "inset") && <label className="template-field">{spec.kind === "inset" ? "局部放大起点 X" : "标注位置 X"}<input aria-label={spec.kind === "inset" ? "局部放大起点 X" : "标注位置 X"} type="number" step="any" value={editor.style.annotationX} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) changeStyle("annotationX", value); }} /></label>}
                    {spec.annotation && <label className="template-field">标注文字<input aria-label="标注文字" value={editor.style.annotationText} onChange={event => changeStyle("annotationText", event.target.value)} /></label>}
                    <div className="l1502-switches"><label><input type="checkbox" checked={editor.style.showGrid} onChange={event => changeStyle("showGrid", event.target.checked)} />显示网格</label><label><input type="checkbox" checked={editor.style.showValues} onChange={event => changeStyle("showValues", event.target.checked)} />显示数值</label>{["line", "scatter", "error-line", "confidence", "dual-axis", "inset"].includes(spec.kind) && <><label><input type="checkbox" checked={editor.logX} onChange={event => setEditor(current => ({ ...current, logX: event.target.checked }))} />X 对数轴</label><label><input type="checkbox" checked={editor.logY} onChange={event => setEditor(current => ({ ...current, logY: event.target.checked }))} />Y 对数轴</label></>}</div>
                    <label className="template-field">图注<textarea aria-label="图注" rows={2} value={editor.caption} onChange={event => setEditor(current => ({ ...current, caption: event.target.value }))} placeholder="样品、条件、单位与误差含义…" /></label>
                </fieldset>
                <p className="template-input-guide">字号按导出物理宽度换算；刻度、图例与注释采用较小字号，可在导出检查中核对。多面板默认双栏，保持各面板文字清晰。</p>
                </div></details>
                <details className="l1502-export-section" open><summary><Download size={15} />导出图表<span>SVG · PNG · PDF</span></summary><div>
                <PublicationExport width={editor.style.width} height={editor.style.height} settings={editor.exportSettings} onChange={exportSettings => setEditor(current => ({ ...current, exportSettings }))} getSvg={getSvg} filename={editor.style.title || template.name} disabled={!rendered.option || busy} onBusy={setExporting} revision={editor} />
                </div></details>
                {onAddToComposition && <button type="button" className="resource-button is-primary l1502-composition" disabled={!rendered.option || locked} onClick={addToComposition}><Layers3 size={16} />{assetId ? "更新论文组图中的此图" : "加入论文组图"}</button>}
            </section>
            <section className={`template-preview-panel template-glass${comparePalettes && !scalarOnly ? " is-comparing" : ""}`} aria-label="固定图表预览">
                <div className="l1502-preview-heading"><div><span className="template-eyebrow">PUBLICATION CANVAS</span><h3>你的科研图表</h3></div><span className={`template-data-badge${editor.source.kind === "demo" ? " is-demo" : ""}`}><i />{editor.source.kind === "demo" ? "示例数据" : "你的实验数据"}</span></div>
                <div className="template-preview-controls"><button type="button" aria-pressed={!actualPreview} onClick={() => setActualPreview(false)}>适应窗口</button><button type="button" aria-pressed={actualPreview} onClick={() => setActualPreview(true)}>原始尺寸</button>{!scalarOnly && <button type="button" aria-pressed={comparePalettes} disabled={locked || !rendered.option} onClick={() => setComparePalettes(value => !value)}><Palette size={12} />配色对照</button>}{canExportChartCode(rendered.option) && <button type="button" disabled={locked} onClick={() => setCodeEditorOpen(true)}><Code2 size={13} />代码编辑</button>}<span>{editor.style.width} × {editor.style.height} px</span></div>
                <div ref={previewRef} className={`template-chart-wrap l1502-chart-wrap${comparePalettes ? " is-comparing" : ""}`}>
                    <PaletteComparison open={comparePalettes && !scalarOnly} onClose={() => setComparePalettes(false)} value={findChartPalette(editor.style.colors)?.id ?? null} currentOption={rendered.option} preview={palettePreview} disabled={locked} onApply={id => { changePalette(id); setComparePalettes(false); }} />
                    {rendered.option ? <div style={{ display: comparePalettes && !scalarOnly ? "none" : undefined, width: editor.style.width * previewScale, height: editor.style.height * previewScale, margin: "8px auto", overflow: "hidden" }}><div style={{ width: editor.style.width, height: editor.style.height, transform: `scale(${previewScale})`, transformOrigin: "top left" }}><ReactECharts ref={chartRef} option={rendered.option} notMerge opts={{ renderer: "svg", width: editor.style.width, height: editor.style.height }} style={{ width: editor.style.width, height: editor.style.height }} /></div></div> : <div className="template-chart-empty">完成字段绑定后，图表将在这里生成。</div>}
                </div>
                <div className="l1502-canvas-note"><span>图表固定预览 · 参数可独立滚动</span><span>{table.rows.length} 行数据 · {editor.mapping.ys.length} 组数值</span></div>

            </section>
        </div>
        </div>
        <div id={`${tabId}-matlab-panel`} className="l1502-code-panel" role="tabpanel" aria-labelledby={`${tabId}-matlab-tab`} hidden={activeTab !== "matlab"}><L1502MatlabSource issue={spec.issue} active={open && activeTab === "matlab"} /></div>
    </TemplateEditorDialog><ChartCodePlayground open={open && codeEditorOpen} onClose={() => setCodeEditorOpen(false)} option={rendered.option} width={editor.style.width} height={editor.style.height} title={editor.style.title} sourceLabel={editor.source.kind === "demo" ? "示例数据" : editor.source.name} /></>;
}
