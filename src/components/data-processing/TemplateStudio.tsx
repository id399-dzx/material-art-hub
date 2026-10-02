"use client";

import { useEffect, useMemo, useRef, useState, useImperativeHandle, type Ref } from "react";
import Image from "next/image";
import ReactECharts from "echarts-for-react";
import * as XLSX from "xlsx";
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, FileSpreadsheet, FlaskConical, Layers3, Loader2, Palette, SlidersHorizontal, Sparkles, UploadCloud, Search, Zap } from "lucide-react";
import { CHART_TEMPLATES, PANEL_SWEEP_DEMO, isNumericX, isSpatial, isGraph, isBar, matrixToCsv, numericCell, parseTemplateTable, type ColumnMapping, type ErrorInput, type ErrorMeasure, type TemplateId } from "@/lib/data-processing/templates";
import { createTemplateOption, type PublicationStyle } from "@/lib/data-processing/template-chart";
import { DRAWING_TEMPLATES, DRAWING_TYPES, drawingTemplateForChart, type DrawingType, type DrawingTemplate } from "@/lib/data-processing/drawing-catalog";
import { prepareElectrochemicalData, type ImaginaryMode } from "@/lib/data-processing/electrochemistry";
import { suggestElectrochemicalMapping } from "@/lib/data-processing/electrochemical-mapping";
import { buildDrawingData, suggestDrawingMapping } from "@/lib/data-processing/drawing-data";
import { readWorkbook } from "@/lib/data-processing/read-workbook";
import DataAdvisor from "./DataAdvisor";
import PublicationExport from "./PublicationExport";
import TemplateEditorDialog from "./TemplateEditorDialog";
import { initialExportSettings } from "@/lib/data-processing/publication";
import "./template-studio.css";

type Sheet = { name: string; matrix: unknown[][] };
type Source = { name: string; kind: "demo" | "file"; sheets: Sheet[] };
const initial = drawingTemplateForChart("line");

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type TemplateStudioHandle = { loadData: (name: string, matrix: unknown[][], id: TemplateId, mapping: ColumnMapping) => void };
export default function TemplateStudio({ active, ref }: { active: boolean; ref?: Ref<TemplateStudioHandle> }) {
    const [editorOpen, setEditorOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [category, setCategory] = useState<DrawingType | "全部">("全部");
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState("全部来源");
    const [imaginaryMode, setImaginaryMode] = useState<ImaginaryMode | "">("negative-imaginary");
    const [presetId, setPresetId] = useState(initial.id);
    const [referenceColors, setReferenceColors] = useState(!!initial.paper);
    const [hatching, setHatching] = useState(false);
    const [sphereGuide, setSphereGuide] = useState(true);
    const [panelChart, setPanelChart] = useState<"bar" | "line">("bar");
    const [cumulative, setCumulative] = useState(false);
    const [secondaryYLabel, setSecondaryYLabel] = useState("");
    const [annotationX, setAnnotationX] = useState(0.6);
    const [annotationText, setAnnotationText] = useState("参考位置");
    const [yaw, setYaw] = useState(35);
    const [pitch, setPitch] = useState(25);
    const [selected, setSelected] = useState<TemplateId>("line");
    const [source, setSource] = useState<Source>({ name: "折线图示例", kind: "demo", sheets: [{ name: "示例数据", matrix: initial.demo }] });
    const [sheetIndex, setSheetIndex] = useState(0);
    const [hasHeader, setHasHeader] = useState(true);
    const [mapping, setMapping] = useState<ColumnMapping>(() => suggestDrawingMapping(parseTemplateTable(initial.demo), "line", initial.variant));
    const [showUncertainty, setShowUncertainty] = useState(true);
    const [errorInput, setErrorInput] = useState<ErrorInput>("replicates");
    const [errorMeasure, setErrorMeasure] = useState<ErrorMeasure>("SD");
    const [title, setTitle] = useState(initial.name);
    const [xLabel, setXLabel] = useState(initial.xLabel);
    const [yLabel, setYLabel] = useState(initial.yLabel);
    const [palette, setPalette] = useState<PublicationStyle>("journal");
    const [fontFamily, setFontFamily] = useState("Arial");
    const [fontSize, setFontSize] = useState(8);
    const [width, setWidth] = useState(680);
    const [height, setHeight] = useState(420);
    const [showGrid, setShowGrid] = useState(false);
    const [showValues, setShowValues] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportSettings, setExportSettings] = useState(initialExportSettings);
    const [caption, setCaption] = useState("");
    const [fileError, setFileError] = useState("");
    const [exportError, setExportError] = useState("");
    const chartRef = useRef<ReactECharts>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [previewWidth, setPreviewWidth] = useState(680);
    const [actualPreview, setActualPreview] = useState(false);
    const template = DRAWING_TEMPLATES.find(item => item.id === presetId)!;
    const groupedPoints = template.variant === "embedding-scatter" || template.variant === "position-scatter";
    const groupedSamples = template.variant === "grouped-box";
    const pairedComparison = template.variant === "paired-correlation";
    const currentDemo = selected === "multi-panel" && panelChart === "line" ? PANEL_SWEEP_DEMO : template.demo;
    const catalog = DRAWING_TEMPLATES.filter(item => sourceFilter === "全部来源" || (sourceFilter === "论文图式" ? !!item.paper : sourceFilter === "电化学专栏" ? !!item.electrochemical : !item.paper && !item.electrochemical));
    const filtered = catalog.filter(item => (category === "全部" || item.category === category) && `${item.name} ${item.english} ${item.tag} ${item.description} ${item.paper?.figureName ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
    const table = useMemo(() => parseTemplateTable(source.sheets[sheetIndex]?.matrix ?? [], hasHeader), [source, sheetIndex, hasHeader]);
    const drawingId = template.electrochemical?.kind === "cycle" && mapping.ys.length === 1 ? "line" : selected === "error-bar" && !showUncertainty ? template.paper?.region.kind === "horizontal" ? "horizontal-bar" : "grouped-bar" : selected;
    const boundResult = useMemo(() => buildDrawingData(table, mapping, drawingId, template.variant, errorInput, errorMeasure, panelChart), [table, mapping, drawingId, template.variant, errorInput, errorMeasure, panelChart]);
    const result = useMemo(() => {
        if (!boundResult.data || !template.electrochemical) return boundResult;
        if (template.electrochemical.kind === "nyquist" && !imaginaryMode) return { data: null, error: "请确认虚部列的符号约定，再生成 Nyquist 图。" };
        const prepared = prepareElectrochemicalData(boundResult.data, template.electrochemical, imaginaryMode || "negative-imaginary");
        return { data: prepared.data ?? null, error: prepared.error ?? null };
    }, [boundResult, template.electrochemical, imaginaryMode]);
    const chartWidth = Number.isFinite(width) && width >= 420 && width <= 1600 ? width : 680;
    const chartHeight = Number.isFinite(height) && height >= 320 && height <= 1000 ? height : 420;
    const safeFontSize = Number.isFinite(fontSize) && fontSize >= 5 && fontSize <= 16 ? fontSize : 8;
    const canvasFontSize = safeFontSize * 25.4 / 72 * chartWidth / exportSettings.widthMm;
    const option = useMemo(() => result.data ? createTemplateOption(result.data, drawingId, {
        title: `${title}${source.kind === "demo" ? " · 示例数据" : ""}`, xLabel, yLabel, fontFamily, fontSize: canvasFontSize, palette, showGrid, showValues, errorMeasure, panelChart, cumulative, secondaryYLabel, annotationX, annotationText, yaw, pitch, width: chartWidth, height: chartHeight,
        customColors: referenceColors ? template.paper?.region.colors : undefined,
        horizontal: template.paper?.region.kind === "horizontal", colorByCategory: referenceColors && template.paper?.region.kind === "bars",
        stackedArea: template.paper?.region.kind === "area", hatching,
        fillLines: template.paper?.region.fillSeries, sphereGuide,
        variant: template.variant,
        xLog: template.electrochemical?.xLog, yLog: template.electrochemical?.yLog, equalAxes: template.electrochemical?.equalAxes,
    }) : null, [result.data, drawingId, title, source.kind, xLabel, yLabel, fontFamily, canvasFontSize, palette, showGrid, showValues, errorMeasure, panelChart, cumulative, secondaryYLabel, annotationX, annotationText, yaw, pitch, chartWidth, chartHeight, referenceColors, hatching, sphereGuide, template.paper, template.variant, template.electrochemical]);

    useEffect(() => {
        if (active && new URLSearchParams(window.location.search).get("templates") === "electrochem") setCategory("电化学测试");
    }, [active]);

    function chooseCategory(next: DrawingType | "全部") {
        setCategory(next);
        if (next === "电化学测试" || sourceFilter === "电化学专栏") setSourceFilter("全部来源");
        const url = new URL(window.location.href);
        if (next === "电化学测试") url.searchParams.set("templates", "electrochem");
        else url.searchParams.delete("templates");
        window.history.replaceState(null, "", url);
    }

    function chooseSource(next: string) {
        if (next === "电化学专栏") chooseCategory("电化学测试");
        else if (category === "电化学测试" && next !== "全部来源") chooseCategory("全部");
        setSourceFilter(next);
    }

    useEffect(() => {
        if (!active || !editorOpen) return;
        const frame = requestAnimationFrame(() => chartRef.current?.getEchartsInstance()?.resize({ width: chartWidth, height: chartHeight }));
        return () => cancelAnimationFrame(frame);
    }, [active, editorOpen, chartWidth, chartHeight]);

    useEffect(() => {
        const element = previewRef.current;
        if (!active || !editorOpen || !element) return;
        const observer = new ResizeObserver(entries => {
            const available = entries[0]?.contentRect.width;
            if (available && available > 0) setPreviewWidth(available);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [active, editorOpen]);
    const previewScale = actualPreview ? 1 : Math.min(1, Math.max(1, previewWidth - 24) / chartWidth);

    function bindTable(next: Source, nextSheet = 0, headers = true, id = selected, panelMode = panelChart, preset: DrawingTemplate = template) {
        const nextTable = parseTemplateTable(next.sheets[nextSheet]?.matrix ?? [], headers);
        const nextMapping = preset.electrochemical ? suggestElectrochemicalMapping(nextTable, preset.electrochemical) : suggestDrawingMapping(nextTable, id, preset.variant, panelMode);
        setSource(next);
        setSheetIndex(nextSheet);
        setHasHeader(headers);
        setMapping(nextMapping);
        setXLabel(id === "heatmap" ? preset.xLabel : nextTable.columns[nextMapping.x] || "X");
        setYLabel(isSpatial(id) ? nextTable.columns[nextMapping.ys[0]] || "Y" : next.kind === "demo" ? preset.yLabel : id === "heatmap" ? nextTable.columns[nextMapping.x] || preset.yLabel : preset.electrochemical || preset.variant ? nextTable.columns[nextMapping.ys[0]] || preset.yLabel : "数值");
        setSecondaryYLabel(next.kind === "demo" && preset.electrochemical?.secondaryYLabel || nextTable.columns[nextMapping.ys[1]] || "右轴指标");
        if (preset.electrochemical?.kind === "nyquist") setImaginaryMode(next.kind === "demo" ? "negative-imaginary" : "");
        const middleX = numericCell(nextTable.rows[Math.floor(nextTable.rows.length / 2)]?.[nextMapping.x]);
        setAnnotationX(middleX ?? 0.6);
        const errorColumns = Object.values(nextMapping.errors).map(index => nextTable.columns[index]);
        setErrorInput(errorColumns.length ? "summary" : "replicates");
        setShowUncertainty(id !== "error-bar" || errorColumns.length > 0 || next.kind === "demo" && nextMapping.ys.length >= 2);
        setErrorMeasure(errorColumns.length && errorColumns.every(name => /sem|标准误|standard.?error/i.test(name)) ? "SEM" : "SD");
        setFileError("");
        setExportError("");
    }

    function chooseTemplate(preset: string) {
        const next = DRAWING_TEMPLATES.find(item => item.id === preset)!;
        setEditorOpen(true); setHasOpened(true);
        if (preset === presetId) return;
        const id = next.chartId;
        setPresetId(preset); setSelected(id); setReferenceColors(!!next.paper); if(next.paper)setPalette("journal");
        setHatching(!!next.paper?.region.hatching); setSphereGuide(next.variant !== "spatial-vectors");
        setCumulative(false);
        setPanelChart("bar");
        setWidth(id === "multi-panel" || id === "schematic" ? 900 : 680);
        setHeight(id === "multi-panel" ? 620 : 420);
        setTitle(next.name);
        if (source.kind === "demo") bindTable({ name: `${next.name}示例`, kind: "demo", sheets: [{ name: "示例数据", matrix: next.demo }] }, 0, true, id, "bar", next);
        else bindTable(source, sheetIndex, hasHeader, id, "bar", next);
    }

    async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setFileError("");
        if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { setFileError("请上传 CSV、XLSX 或 XLS 格式的表格。"); return; }
        if (file.size > 10 * 1024 * 1024) { setFileError("模板绘图支持不超过 10 MB 的文件，请精简表格后重新上传。"); return; }
        setLoading(true);
        try {
            const workbook = readWorkbook(await file.arrayBuffer(), file.name);
            const sheets = workbook.SheetNames.map(name => ({ name, matrix: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: null, blankrows: true }) }));
            const first = sheets.findIndex(sheet => parseTemplateTable(sheet.matrix, false).rows.length > 0);
            if (first < 0) throw new Error("文件中没有可读取的数据，请检查表头和数据行。");
            bindTable({ name: file.name, kind: "file", sheets }, first, true);
            setTitle(file.name.replace(/\.[^.]+$/, ""));
        } catch (error) {
            setFileError(error instanceof Error ? error.message : "文件读取失败，请检查表格格式。");
        } finally { setLoading(false); }
    }

    function toggleY(index: number) {
        setMapping(current => ({ ...current, ys: selected === "box" || selected === "violin" || groupedPoints ? current.ys.includes(index) ? [] : [index] : current.ys.includes(index) ? current.ys.filter(y => y !== index) : [...current.ys, index].sort((a, b) => a - b), ...(current.group === index ? { group: undefined } : {}) }));
        setExportError("");
    }

    function bindElectrochemicalY(axis: 0 | 1, value: string) {
        const index = value === "" ? undefined : Number(value);
        const ys = axis === 0 ? index === undefined ? [] : [index, ...mapping.ys.slice(1).filter(y => y !== index)] : index === undefined ? mapping.ys.slice(0, 1) : [mapping.ys[0], index];
        setMapping(current => ({ ...current, ys }));
        if (axis === 0 && index !== undefined) setYLabel(table.columns[index]);
        if (axis === 1 && index !== undefined) setSecondaryYLabel(table.columns[index]);
        setExportError("");
    }

    function applyRecommendation(id: TemplateId, nextMapping: ColumnMapping) {
        const representative = drawingTemplateForChart(id);
        setPresetId(representative.id); setReferenceColors(!!representative.paper);
        setHatching(!!representative.paper?.region.hatching); setSphereGuide(true);
        const next = CHART_TEMPLATES.find(item => item.id === id)!;
        setSelected(representative.chartId); setMapping(nextMapping); setPanelChart("bar"); setCumulative(false);
        if (id === "horizontal-bar") setShowUncertainty(false);
        setXLabel(table.columns[nextMapping.x] || next.xLabel);
        setYLabel(id === "histogram" ? "样本数" : table.columns[nextMapping.ys[0]] || next.yLabel);
        setTitle(source.kind === "file" ? source.name.replace(/\.[^.]+$/, "") : next.name);
        setFileError(""); setExportError("");
        requestAnimationFrame(() => document.getElementById("template-editor")?.closest(".template-dialog-content")?.scrollTo({ top: 0, behavior: "smooth" }));
    }
    useImperativeHandle(ref, () => ({ loadData(name, matrix, id, nextMapping) {
        const representative = drawingTemplateForChart(id);
        setEditorOpen(true); setHasOpened(true); setPresetId(representative.id); setReferenceColors(!!representative.paper);
        setHatching(!!representative.paper?.region.hatching); setSphereGuide(true);
        const next = CHART_TEMPLATES.find(item => item.id === id)!;
        bindTable({ name, kind: "file", sheets: [{ name: "已处理 XY 数据", matrix }] }, 0, true, id, "bar", representative);
        setSelected(representative.chartId); setMapping(nextMapping); setPanelChart("bar"); setCumulative(false);
        if (id === "horizontal-bar") setShowUncertainty(false);
        setTitle(name); setXLabel(String(matrix[0]?.[nextMapping.x] ?? next.xLabel));
        setYLabel(id === "histogram" ? "样本数" : String(matrix[0]?.[nextMapping.ys[0]] ?? next.yLabel));
    } }));
    function exportSvg() {
        if (!chartRef.current) throw new Error("请先完成数据绑定，等待图表呈现。");
        const svg = chartRef.current.getEchartsInstance().renderToSVGString();
        const desc = document.createElementNS("http://www.w3.org/2000/svg", "desc");
        desc.textContent = `${template.paper ? `Single-chart reference: Chen Liu et al., figures4papers, CC BY-NC 4.0; ${template.paper.source}; ${template.paper.regionId}. ` : ""}${source.kind === "demo" ? "演示数据；" : "用户提供数据；"}${template.electrochemical ? `电化学图式：${template.name}；${template.electrochemical.kind === "nyquist" ? imaginaryMode === "raw-imaginary" ? "原始 Im(Z) 乘以 −1，未取绝对值；" : "输入 −Im(Z)，保持原值；" : template.electrochemical.kind === "bode" ? "原始频率和阻抗模值使用对数轴，相位使用线性轴；" : "保留采集顺序；"}` : ""}${caption || "统计图注由用户核对。"}`;
        return svg.replace(/(<svg\b[^>]*>)/, root => root + new XMLSerializer().serializeToString(desc));
    }

    return (
        <section id="paper-figures" className="template-studio drawing-library" hidden={!active} aria-labelledby="template-studio-title">
            <div id="data-templates" aria-hidden="true" />
            <div className="template-intro">
                <div><span className="template-eyebrow"><Layers3 size={14} /> PAPER DRAWING LIBRARY / 论文图例模板</span><h2 id="template-studio-title">从一张图开始<span>。</span></h2><p>按图形类型选择模板，上传你的数据生成独立图表；组数、名称和范围由你的数据决定。</p></div>
                <div className="template-intro-note"><span><Sparkles size={15} /> 独立图式完整保留</span><p>{DRAWING_TEMPLATES.length} 个数据模板<br />相同结构合并 · 小提琴全部保留</p></div>
            </div>
            <div className="template-catalog-toolbar">
                <div className="template-category-tabs" role="group" aria-label="图形类型">{(["全部", ...DRAWING_TYPES] as const).map(item => <button key={item} type="button" aria-pressed={category === item} className={`${category === item ? "is-active" : ""}${item === "电化学测试" ? " electrochemical-tab" : ""}`} onClick={() => chooseCategory(item)}>{item === "电化学测试" && <Zap size={13} />}{item}<small>{item === "全部" ? catalog.length : catalog.filter(t => t.category === item).length}</small></button>)}</div>
            </div>
            <div className="drawing-library-tools"><label className="drawing-source-filter">模板来源<select aria-label="模板来源" value={sourceFilter} onChange={e=>chooseSource(e.target.value)}>{["全部来源","通用模板","论文图式","电化学专栏"].map(item=><option key={item}>{item}</option>)}</select></label><label className="template-search"><Search size={15} /><input aria-label="搜索模板" placeholder="搜索 CV、阻抗、图形或用途" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
            <div className="template-catalog-meta"><span>显示 {filtered.length} / {DRAWING_TEMPLATES.length} 个模板</span><span>点击任一模板，弹出单图编辑工作台</span></div>
            {(category === "全部" ? DRAWING_TYPES : [category]).map(kind => {
                const items = filtered.filter(item => item.category === kind);
                if (!items.length) return null;
                return <section className="drawing-type-group" key={kind} aria-label={`${kind}模板`}>
                    {kind === "电化学测试" ? <div className="electrochemical-column-heading"><span className="electrochemical-column-icon"><Zap size={22} /></span><div><span className="template-eyebrow">ELECTROCHEMISTRY / 专栏</span><h3>电化学测试图</h3><p>伏安 · 充放电 · 性能 · 阻抗谱，选择图式后替换实验数据。</p></div><span className="electrochemical-column-count">{items.length} 个模板</span></div> : category === "全部" && <div className="drawing-type-heading"><h3>{kind}</h3><span>{items.length} 个模板</span></div>}
                    <div className="template-gallery" aria-label={`选择${kind}模板`}>{items.map(item => <button key={item.id} type="button" className={`template-card${hasOpened && presetId === item.id ? " is-selected" : ""}`} aria-haspopup="dialog" aria-pressed={hasOpened && presetId === item.id} onClick={() => chooseTemplate(item.id)} disabled={loading || exporting}>
                        <div className={`template-card-art${item.paper ? " template-card-art--paper" : item.electrochemical ? " template-card-art--electrochemical" : ` template-card-art--${item.id}`}`}><span className="template-card-number">{String(DRAWING_TEMPLATES.indexOf(item) + 1).padStart(2, "0")}</span><span className="template-card-tag">{item.tag}</span><Image src={item.preview} width={680} height={420} alt={`${item.name}完整图表预览`} /></div>
                        <div className="template-card-body"><span className="template-eyebrow">{item.english}</span><h3>{item.name}</h3><p>{item.description}</p><div className="template-card-bottom"><small>{item.requirement}</small><span>{hasOpened && presetId === item.id ? <><Check size={14} /> 继续编辑</> : <><ArrowRight size={15} /> 使用模板</>}</span></div></div>
                    </button>)}</div>
                </section>;
            })}
            {!filtered.length && <p className="template-search-empty">没有匹配的模板，请更换关键词、图形类型或来源。</p>}
            <TemplateEditorDialog open={active && editorOpen} title={template.name} eyebrow="SINGLE CHART EDITOR / 单图编辑" description="只编辑这一张图：导入数据、绑定字段，预览并导出。无需与原论文的面板数量一致。" busy={loading || exporting} onClose={() => setEditorOpen(false)}>
            <div className="template-flow" aria-label="模板使用流程"><span className="is-complete"><Check size={14} /> 01 选择模板</span><i /><span><FileSpreadsheet size={14} /> 02 导入与绑定</span><i /><span><ArrowDownToLine size={14} /> 03 预览与导出</span></div>

            <div id="template-editor" className="template-editor">
                <section className="template-input-panel template-glass" aria-labelledby="template-data-title">
                    <div className="template-section-heading"><span className="template-section-icon"><FileSpreadsheet size={18} /></span><div><h3 id="template-data-title">让模板读懂你的数据</h3><p>当前模板：{template.name}</p></div></div>
                    <p className="template-input-guide">{template.guide}</p>
                    {template.paper && <details className="template-reference"><summary>查看图式来源与完整预览</summary><Image src={template.preview} width={680} height={420} alt={`${template.name}完整图表预览`} /><p>图式参考：{template.paper.figureName} · {template.paper.region.name}。预览由同一绘图引擎和演示数据完整生成；上传后按你的数据重新绘制。</p><a href={`https://github.com/ChenLiu-1996/figures4papers/blob/main/${template.paper.source}`} target="_blank" rel="noreferrer">Chen Liu 与合作者 · figures4papers · CC BY-NC 4.0</a></details>}
                    <label className={`template-upload${loading ? " is-loading" : ""}`} htmlFor="template-data-upload">
                        <input id="template-data-upload" type="file" accept=".csv,.xlsx,.xls" onChange={importFile} disabled={loading} className="sr-only" />
                        {loading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}<strong>{loading ? "正在读取表格…" : "导入自己的实验数据"}</strong><span>CSV / Excel · 最大 10 MB</span>
                    </label>
                    <div className="template-example-actions"><button type="button" onClick={() => bindTable({ name: `${template.name}示例`, kind: "demo", sheets: [{ name: "示例数据", matrix: currentDemo }] })} disabled={loading}><FlaskConical size={14} /> 载入示例</button><button type="button" onClick={() => downloadBlob(new Blob([matrixToCsv(currentDemo)], { type: "text/csv;charset=utf-8" }), `${template.name}-示例.csv`)}><ArrowDownToLine size={14} /> 下载示例表格</button></div>
                    {fileError && <p className="template-notice template-notice--error" role="alert">{fileError}</p>}
                    <div className="template-source-meta"><span>{source.kind === "demo" ? "示例数据" : "已导入"}</span><strong title={source.name}>{source.name}</strong><small>{table.rows.filter(row => row.some(cell => cell !== null && cell !== "")).length} 行 · {table.columns.length} 列</small></div>
                    {source.sheets.length > 1 && <label className="template-field">工作表<div className="template-select-wrap"><select value={sheetIndex} onChange={event => bindTable(source, Number(event.target.value), hasHeader)}>{source.sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}</option>)}</select><ChevronDown size={14} /></div></label>}
                    <label className="template-checkbox"><input type="checkbox" checked={hasHeader} onChange={event => bindTable(source, sheetIndex, event.target.checked)} /> 首行为列名</label>
                    <div className="template-table-wrap" tabIndex={0} aria-label="数据预览，可横向滚动"><table><thead><tr><th scope="col">行</th>{table.columns.map((name, index) => <th scope="col" key={index}>{name}</th>)}</tr></thead><tbody>{table.rows.slice(0, 4).map((row, index) => <tr key={index}><td>{table.firstDataRow + index}</td>{row.map((value, column) => <td key={column}>{value ?? "—"}</td>)}</tr>)}</tbody></table></div>

                    <div className="template-binding-heading"><SlidersHorizontal size={15} /><h4>数据列绑定</h4><span>即时预览</span></div>
                    <label className="template-field">{template.variant === "density-heatmap" ? "Y 轴数值坐标列" : pairedComparison ? "配对对象 / 类别列" : template.variant === "position-scatter" ? "位置 / 类别列" : selected === "histogram" ? "原始样本数值列" : isGraph(selected) ? "起点 / 起始步骤列" : (isNumericX(selected) || selected === "multi-panel" && panelChart === "line") ? "X 轴数值列" : selected === "radar" ? "指标名称列" : selected === "trend" ? "时间标签列" : "类别 / 行名称列"}<div className="template-select-wrap"><select value={mapping.x} onChange={event => { const x = Number(event.target.value); setMapping(current => ({ ...current, x, ys: isSpatial(selected) || isGraph(selected) ? current.ys.map(y => y === x ? -1 : y) : current.ys.filter(y => y !== x), ...(current.group === x ? { group: undefined } : {}) })); if (selected === "heatmap") setYLabel(table.columns[x]); else setXLabel(table.columns[x]); }}>{table.columns.map((name, index) => <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>
                    {(groupedPoints || groupedSamples || pairedComparison) && <label className="template-field">{pairedComparison ? "比较条件列（两种条件）" : groupedSamples ? "组内系列 / 处理组列" : "样品 / 分类列（可选）"}<div className="template-select-wrap"><select value={mapping.group ?? ""} onChange={event => { const value = event.target.value; setMapping(current => ({ ...current, group: value === "" ? undefined : Number(value) })); }}><option value="">{groupedPoints ? "不分组 · 全部观测" : "请选择分组列"}</option>{table.columns.map((name, index) => index !== mapping.x && !mapping.ys.includes(index) && <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>}
                    {groupedSamples && <p className="template-hint">同一类别内按处理组并排绘制箱线与原始点。每行一个真实观测，不把两层分组拼成单个类别。</p>}
                    {pairedComparison && <p className="template-hint">每个条件内，每个对象对应一行。两种条件分别连线；仅同名对象画配对虚线，缺少的配对不补值。</p>}
                    {groupedPoints && <p className="template-hint">每行一个观测点，重复的 X 值会保留。分类列决定点的颜色，不自动拟合或添加抖动。</p>}
                    {selected === "histogram" && <p className="template-hint">当前列为原始样本数值；直方图不需要绑定 Y 列。</p>}
                    {selected === "multi-panel" && <div className="template-segment" role="group" aria-label="分面图形">{(["bar", "line"] as const).map(kind => <button type="button" key={kind} aria-pressed={panelChart === kind} className={panelChart === kind ? "is-active" : ""} onClick={() => { setPanelChart(kind); if (source.kind === "demo") bindTable({ name: kind === "line" ? "参数扫描示例" : "分面比较示例", kind: "demo", sheets: [{ name: "示例数据", matrix: kind === "line" ? PANEL_SWEEP_DEMO : template.demo }] }, 0, true, selected, kind); else bindTable(source, sheetIndex, hasHeader, selected, kind); }}>{kind === "bar" ? "柱状比较" : "参数扫描折线"}</button>)}</div>}
                    {selected === "error-bar" && <><label className="template-checkbox"><input type="checkbox" checked={showUncertainty} onChange={e=>setShowUncertainty(e.target.checked)} />绘制误差条</label>{!showUncertainty && <p className="template-hint">当前只绘制数值，不自动生成误差。提供独立重复实验或误差列后，可勾选绘制误差条。</p>}</>}
                    {selected === "error-bar" && showUncertainty && <><div className="template-segment" role="group" aria-label="误差数据格式"><button type="button" aria-pressed={errorInput === "replicates"} className={errorInput === "replicates" ? "is-active" : ""} onClick={() => setErrorInput("replicates")}>重复实验列</button><button type="button" aria-pressed={errorInput === "summary"} className={errorInput === "summary" ? "is-active" : ""} onClick={() => setErrorInput("summary")}>均值＋误差列</button></div><label className="template-field">误差条含义<div className="template-select-wrap"><select value={errorMeasure} onChange={event => setErrorMeasure(event.target.value as ErrorMeasure)}><option value="SD">SD · 样本标准差</option><option value="SEM">SEM · 均值标准误</option></select><ChevronDown size={14} /></div></label><p className="template-hint">{errorInput === "replicates" ? "每行代表一个样品，选择至少 2 列独立重复实验。SD 使用 n−1 分母；SEM = SD / √n。" : "每行代表一个样品。误差列应填写所选 SD 或 SEM 的非负数值，此处不进行自动换算。"}</p></>}
                    {template.electrochemical && selected === "dual-axis" ? <div className="electrochemical-axis-bindings">
                        {([0, 1] as const).map(axis => <label className="template-field" key={axis}>{axis === 0 ? template.electrochemical?.kind === "bode" ? "左轴 · 阻抗模值 |Z| 列" : "左轴 · 容量 / 保持率列" : template.electrochemical?.kind === "bode" ? "右轴 · 相位角列" : "右轴 · 库仑效率列（可选）"}<div className="template-select-wrap"><select value={mapping.ys[axis] ?? ""} onChange={event => bindElectrochemicalY(axis, event.target.value)}><option value="">{axis === 1 && template.electrochemical?.kind === "cycle" ? "不显示库仑效率" : "请选择数据列"}</option>{table.columns.map((name, index) => index !== mapping.x && index !== mapping.ys[axis === 0 ? 1 : 0] && <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>)}
                    </div> : isSpatial(selected) || isGraph(selected) ? <div>
                        {(isSpatial(selected) ? ["Y 坐标列", "Z 坐标列"] : selected === "network" ? ["终点列", "权重列（可选）"] : ["后续步骤列"]).map((label, position) => <label className="template-field" key={label}>{label}<div className="template-select-wrap"><select value={mapping.ys[position] === -1 ? "" : mapping.ys[position] ?? ""} onChange={event => { const value = event.target.value; setMapping(current => { const ys = [...current.ys]; if (!value && selected === "network" && position === 1) ys.splice(position, 1); else ys[position] = value === "" ? -1 : Number(value); return { ...current, ys }; }); }}><option value="">{position === 1 && selected === "network" ? "无权重 · 每条连接等宽" : "请选择数据列"}</option>{table.columns.map((name, index) => index !== mapping.x && !mapping.ys.some((y, i) => y === index && i !== position) && <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>)}
                    </div> : <fieldset className="template-y-fields" hidden={selected === "histogram"}><legend>{groupedPoints ? "Y 观测值列（选择一列）" : template.variant === "density-heatmap" ? "数值 X 坐标列（列名须为数值）" : selected === "box" || selected === "violin" ? "原始样本 Y 列（选择一列）" : selected === "error-bar" && showUncertainty ? errorInput === "replicates" ? "重复实验列" : "均值列" : selected === "radar" ? "方法 / 样品数值列" : selected === "heatmap" ? "矩阵数值列" : "Y 数据列（可多选）"}</legend>{table.columns.map((name, index) => index !== mapping.x && index !== mapping.group && <label key={index} className="template-column-choice"><span><input type="checkbox" checked={mapping.ys.includes(index)} onChange={() => toggleY(index)} />{name}</span><small>{table.rows.some(row => numericCell(row[index]) !== null) ? "数值" : "文本"}</small></label>)}</fieldset>}
                    {template.electrochemical?.kind === "nyquist" && <><label className="template-field">虚部列输入约定<div className="template-select-wrap"><select value={imaginaryMode} onChange={event => { const mode = event.target.value as ImaginaryMode | ""; setImaginaryMode(mode); const name = table.columns[mapping.ys[0]] || template.yLabel; setYLabel(mode === "raw-imaginary" ? `−(${name})` : name); }}><option value="">请确认虚部的符号</option><option value="negative-imaginary">已经是 −Im(Z) · 保持原值</option><option value="raw-imaginary">原始 Im(Z) · 虚部取负</option></select><ChevronDown size={14} /></div></label><p className="template-hint">取负只乘以 −1，不取绝对值。实部与虚部请使用相同单位；两轴单位长度相同。</p></>}
                    {template.electrochemical?.kind === "bode" && <p className="template-hint">绑定原始频率与 |Z|，两者使用对数坐标；相位保留正负号，使用右侧线性坐标。</p>}
                    {selected === "error-bar" && showUncertainty && errorInput === "summary" && mapping.ys.map(y => <label className="template-field" key={y}>{table.columns[y]} · 误差列<div className="template-select-wrap"><select value={mapping.errors[y] ?? ""} onChange={event => setMapping(current => ({ ...current, errors: { ...current.errors, [y]: Number(event.target.value) } }))}><option value="" disabled>请选择误差列</option>{table.columns.map((name, index) => index !== mapping.x && !mapping.ys.includes(index) && <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>)}
                    {result.error && <p className="template-notice template-notice--error" role="alert">{result.error}</p>}
                    {!!result.data?.skipped && <div className="template-notice" role="status"><strong>已跳过 {result.data.skipped} 行不完整数据</strong>{result.data.warnings.map(message => <p key={message}>{message}</p>)}</div>}
                    {!!result.data?.warnings.length && !result.data.skipped && <div className="template-notice" role="status">{result.data.warnings.map(message => <p key={message}>{message}</p>)}</div>}
                </section>

                <div className="template-output-column">
                    <section className="template-preview-panel template-glass" aria-labelledby="template-preview-title">
                        <div className="template-preview-heading"><div><span className="template-eyebrow">PUBLICATION CANVAS</span><h3 id="template-preview-title">你的图表，正在成形</h3></div><span className={`template-data-badge${source.kind === "demo" ? " is-demo" : ""}`}><i />{source.kind === "demo" ? "示例 · 非真实实验结果" : "你的实验数据"}</span></div>
                        <div className="template-preview-controls"><button type="button" aria-pressed={!actualPreview} onClick={() => setActualPreview(false)}>适应窗口</button><button type="button" aria-pressed={actualPreview} onClick={() => setActualPreview(true)}>原始尺寸</button><span>预览缩放不改变导出规格</span></div><div className="template-chart-frame"><div className="template-chart-scroll" ref={previewRef}>{active && hasOpened && option ? <div style={{ width: chartWidth * previewScale, height: chartHeight * previewScale, flex: "0 0 auto" }}><div style={{ width: chartWidth, height: chartHeight, transform: `scale(${previewScale})`, transformOrigin: "top left" }}><ReactECharts ref={chartRef} option={option} opts={{ renderer: "svg", width: chartWidth, height: chartHeight }} style={{ width: chartWidth, height: chartHeight }} notMerge /></div></div> : <div className="template-chart-empty"><SlidersHorizontal size={30} /><strong>完成列绑定后，图表会在这里呈现</strong><p>{result.error}</p></div>}</div></div>
                        <p className="template-chart-mobile-hint">预览自动适应窗口；切换原始尺寸可滑动查看细节。</p>
                        <div className="template-chart-footer"><span>{result.data ? isGraph(selected) ? `${result.data.x.length} 个节点 · ${result.data.edges?.length} 条连接` : isSpatial(selected) ? `${result.data.x.length} 个顶点 · X / Y / Z 坐标` : result.data.pointGroups ? `${result.data.pointGroups.reduce((sum, group) => sum + group.points.length, 0)} 个观测点 · ${result.data.pointGroups.length} 组` : result.data.matrixCells ? `${result.data.matrixCells.length} 个有效单元格 · ${result.data.x.length} 行 × ${result.data.series.length} 列` : result.data.samples ? `${result.data.samples.reduce((sum, group) => sum + group.values.length, 0)} 个真实样本 · ${result.data.samples.length} 组` : `${result.data.x.length} ${isNumericX(selected) ? "个数据点" : "行数据"} · ${result.data.series.length} 组数据` : "等待有效数据"}{selected === "error-bar" && showUncertainty && result.data ? ` · ±${errorMeasure}` : ""}</span><span>{chartWidth} × {chartHeight} px</span></div>
                        <PublicationExport width={chartWidth} height={chartHeight} settings={exportSettings} onChange={setExportSettings} getSvg={exportSvg} filename={`${title}${source.kind === "demo" ? "-示例" : ""}`} disabled={!result.data || loading} onBusy={setExporting} revision={option} extraIssues={[
                            ...(source.kind === "demo" ? [{ level: "warning" as const, message: "当前为演示数据，不是真实实验结果。" }] : []),
                            ...(drawingId === "dual-axis" ? [{ level: "warning" as const, message: "双 Y 轴使用独立刻度，请勿据曲线高度判断相关或比较大小。" }] : []),
                            ...(selected === "error-bar" && showUncertainty && !caption.trim() ? [{ level: "warning" as const, message: "请补充统计图注：独立样本量、误差含义和实验重复类型。" }] : []),
                            ...(result.data?.skipped ? [{ level: "warning" as const, message: `绘图跳过 ${result.data.skipped} 行，请对照原始数据检查。` }] : []),
                        ]} />
                        {exportError && <p className="template-notice template-notice--error" role="alert">{exportError}</p>}
                    </section>

                    <section className="template-style-panel template-glass" aria-labelledby="template-style-title">
                        <div className="template-section-heading"><span className="template-section-icon"><Palette size={18} /></span><div><h3 id="template-style-title">最后一点，按你的风格</h3><p>样式调整会立即同步到预览和导出文件。</p></div></div>
                        <div className="template-style-presets" role="group" aria-label="论文图表样式">{template.paper && <button type="button" aria-pressed={referenceColors} className={referenceColors ? "is-active" : ""} onClick={()=>setReferenceColors(true)}><span>{(template.paper.region.colors??["#38679b"]).slice(0,3).map((color,i)=><i key={i} style={{backgroundColor:color}}/>)}</span>图例配色{referenceColors&&<Check size={13}/>}</button>}{([{ id: "accessible", name: "色觉友好", colors: ["#0072B2", "#D55E00", "#009E73"] }, { id: "journal", name: "期刊简洁", colors: ["#38679b", "#c77972", "#64958c"] }, { id: "soft", name: "柔和对比", colors: ["#788bcc", "#d69baf", "#7dafb1"] }, { id: "mono", name: "黑白打印", colors: ["#282828", "#696969", "#a0a0a0"] }] as const).map(item => <button type="button" key={item.id} aria-pressed={!referenceColors && palette === item.id} className={!referenceColors && palette === item.id ? "is-active" : ""} onClick={() => {setPalette(item.id);setReferenceColors(false);}}><span>{item.colors.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>{item.name}{!referenceColors && palette === item.id && <Check size={13} />}</button>)}</div>
                        <div className="template-style-grid"><label className="template-field template-field--wide">图表标题<input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} /></label><label className="template-field">X 轴标题<input value={xLabel} onChange={event => setXLabel(event.target.value)} maxLength={60} /></label><label className="template-field">Y 轴标题<input value={yLabel} onChange={event => setYLabel(event.target.value)} maxLength={60} /></label><label className="template-field">字体<div className="template-select-wrap"><select value={fontFamily} onChange={event => setFontFamily(event.target.value)}><option value="Arial">Arial · 无衬线</option><option value="Times New Roman">Times New Roman · 衬线</option><option value="sans-serif">系统无衬线</option></select><ChevronDown size={14} /></div></label><label className="template-field">最终字号 (pt)<input type="number" min={5} max={16} step={0.5} value={fontSize} onChange={event => setFontSize(Number(event.target.value))} onBlur={() => setFontSize(safeFontSize)} /></label><label className="template-field">画布宽度 (px)<input type="number" min={420} max={1600} step={20} value={width} onChange={event => setWidth(Number(event.target.value))} onBlur={() => setWidth(chartWidth)} /></label><label className="template-field">画布高度 (px)<input type="number" min={320} max={1000} step={20} value={height} onChange={event => setHeight(Number(event.target.value))} onBlur={() => setHeight(chartHeight)} /></label></div>
                        <label className="template-field">统计图注（保存在 SVG 描述中）<input value={caption} maxLength={300} onChange={event => setCaption(event.target.value)} placeholder="如：n=6 独立实验；误差条为 SD；单位见轴标题" /></label>
                        {drawingId === "dual-axis" && <label className="template-field">右侧 Y 轴标题<input value={secondaryYLabel} onChange={event => setSecondaryYLabel(event.target.value)} maxLength={60} /></label>}
                        {(selected === "concept" || template.variant === "filled-distribution") && <div className="template-style-grid"><label className="template-field">标注位置 X<input type="number" step="any" value={annotationX} onChange={event => setAnnotationX(Number(event.target.value))} /></label><label className="template-field">标注文字<input value={annotationText} onChange={event => setAnnotationText(event.target.value)} maxLength={40} /></label></div>}
                        {template.variant === "filled-distribution" && <p className="template-hint">差值标记仅使用该 X 处前两条曲线的实际观测。X 未命中数据点时只显示参考线，不插值或推算差值。</p>}
                        {template.variant === "local-range-radar" && <p className="template-hint">各指标使用当前数据的局部显示区间，轴标签注明最小值与最大值；原始输入值不改写，按各轴量程计算绘制位置，轴起点可能不为零。</p>}
                        {isSpatial(selected) && <div className="template-camera"><label>方位角 {yaw}°<input type="range" min={-180} max={180} value={yaw} onChange={event => setYaw(Number(event.target.value))} /></label><label>仰角 {pitch}°<input type="range" min={-80} max={80} value={pitch} onChange={event => setPitch(Number(event.target.value))} /></label><p>三维坐标以正交投影呈现，导出保留当前视角。</p></div>}
                        <div className="template-style-switches"><label className="template-checkbox"><input type="checkbox" checked={showGrid} onChange={event => setShowGrid(event.target.checked)} /> 显示参考网格</label>{(isBar(selected) || selected === "network") && <label className="template-checkbox"><input type="checkbox" checked={showValues} onChange={event => setShowValues(event.target.checked)} /> 标注数值</label>}</div>
                        {selected === "trend" && <label className="template-checkbox"><input type="checkbox" checked={cumulative} onChange={event => setCumulative(event.target.checked)} />按输入时间顺序计算累计量</label>}
                        {(selected === "stacked-bar" || selected === "percent-bar" || template.variant === "stacked-area") && <label className="template-checkbox"><input type="checkbox" checked={hatching} onChange={event => setHatching(event.target.checked)} />使用纹理区分组成</label>}
                        {selected === "sphere" && template.variant !== "spatial-vectors" && <label className="template-checkbox"><input type="checkbox" checked={sphereGuide} onChange={event => setSphereGuide(event.target.checked)} />显示单位参考球</label>}
                    </section>
                </div>
            </div>
            <details className="template-dialog-advisor"><summary>数据检查与绘图建议 · 缺失值、样本量与推荐图形</summary><DataAdvisor key={`${source.name}-${sheetIndex}-${hasHeader}`} table={table} mapping={mapping} demo={source.kind === "demo"} disabled={loading || exporting} onApply={applyRecommendation} /></details>
            </TemplateEditorDialog>
            <p className="template-bottom-note">按坐标、分组和图形结构去重；密度、注意力、分组箱线等独立图式分别保留。电化学按测试用途分类，小提琴全部保留。全部预览由绘图引擎完整生成，示例非真实实验结果。论文图式参考：Chen Liu 与合作者 · figures4papers · <a href="/paper-figures/LICENSE.txt" target="_blank" rel="noreferrer">CC BY-NC 4.0</a>。</p>
        </section>
    );
}
