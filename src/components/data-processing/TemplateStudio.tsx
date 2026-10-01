"use client";

import { useEffect, useMemo, useRef, useState, useImperativeHandle, type Ref } from "react";
import Image from "next/image";
import ReactECharts from "echarts-for-react";
import * as XLSX from "xlsx";
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, FileSpreadsheet, FlaskConical, Layers3, Loader2, Palette, SlidersHorizontal, Sparkles, UploadCloud, Search } from "lucide-react";
import { buildTemplateData, CHART_TEMPLATES, PANEL_SWEEP_DEMO, TEMPLATE_CATEGORIES, isNumericX, isSpatial, isGraph, isBar, matrixToCsv, numericCell, parseTemplateTable, suggestMapping, type ColumnMapping, type ErrorInput, type ErrorMeasure, type TemplateId, type TemplateCategory } from "@/lib/data-processing/templates";
import { createTemplateOption, type PublicationStyle } from "@/lib/data-processing/template-chart";
import DataAdvisor from "./DataAdvisor";
import PublicationExport from "./PublicationExport";
import { initialExportSettings } from "@/lib/data-processing/publication";
import "./template-studio.css";

type Sheet = { name: string; matrix: unknown[][] };
type Source = { name: string; kind: "demo" | "file"; sheets: Sheet[] };
const initial = CHART_TEMPLATES.find(item => item.id === "line")!;

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
    const [category, setCategory] = useState<TemplateCategory | "全部">("全部");
    const [search, setSearch] = useState("");
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
    const [mapping, setMapping] = useState<ColumnMapping>(() => suggestMapping(parseTemplateTable(initial.demo), "line"));
    const [errorInput, setErrorInput] = useState<ErrorInput>("replicates");
    const [errorMeasure, setErrorMeasure] = useState<ErrorMeasure>("SD");
    const [title, setTitle] = useState("循环性能比较");
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
    const template = CHART_TEMPLATES.find(item => item.id === selected)!;
    const currentDemo = selected === "multi-panel" && panelChart === "line" ? PANEL_SWEEP_DEMO : template.demo;
    const filtered = CHART_TEMPLATES.filter(item => (category === "全部" || item.category === category) && `${item.name} ${item.english} ${item.tag} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));
    const table = useMemo(() => parseTemplateTable(source.sheets[sheetIndex]?.matrix ?? [], hasHeader), [source, sheetIndex, hasHeader]);
    const result = useMemo(() => buildTemplateData(table, mapping, selected, errorInput, errorMeasure, panelChart), [table, mapping, selected, errorInput, errorMeasure, panelChart]);
    const chartWidth = Number.isFinite(width) && width >= 420 && width <= 1600 ? width : 680;
    const chartHeight = Number.isFinite(height) && height >= 320 && height <= 1000 ? height : 420;
    const safeFontSize = Number.isFinite(fontSize) && fontSize >= 5 && fontSize <= 16 ? fontSize : 8;
    const canvasFontSize = safeFontSize * 25.4 / 72 * chartWidth / exportSettings.widthMm;
    const option = useMemo(() => result.data ? createTemplateOption(result.data, selected, {
        title: `${title}${source.kind === "demo" ? " · 示例数据" : ""}`, xLabel, yLabel, fontFamily, fontSize: canvasFontSize, palette, showGrid, showValues, errorMeasure, panelChart, cumulative, secondaryYLabel, annotationX, annotationText, yaw, pitch, width: chartWidth, height: chartHeight,
    }) : null, [result.data, selected, title, source.kind, xLabel, yLabel, fontFamily, canvasFontSize, palette, showGrid, showValues, errorMeasure, panelChart, cumulative, secondaryYLabel, annotationX, annotationText, yaw, pitch, chartWidth, chartHeight]);

    useEffect(() => {
        if (!active) return;
        const frame = requestAnimationFrame(() => chartRef.current?.getEchartsInstance()?.resize({ width: chartWidth, height: chartHeight }));
        return () => cancelAnimationFrame(frame);
    }, [active, chartWidth, chartHeight]);

    useEffect(() => {
        const element = previewRef.current;
        if (!active || !element) return;
        const observer = new ResizeObserver(entries => {
            const available = entries[0]?.contentRect.width;
            if (available && available > 0) setPreviewWidth(available);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [active]);
    const previewScale = actualPreview ? 1 : Math.min(1, Math.max(1, previewWidth - 24) / chartWidth);

    function bindTable(next: Source, nextSheet = 0, headers = true, id = selected, panelMode = panelChart) {
        const nextTable = parseTemplateTable(next.sheets[nextSheet]?.matrix ?? [], headers);
        const nextMapping = suggestMapping(nextTable, id, panelMode);
        setSource(next);
        setSheetIndex(nextSheet);
        setHasHeader(headers);
        setMapping(nextMapping);
        setXLabel(nextTable.columns[nextMapping.x] || "X");
        setYLabel(isSpatial(id) ? nextTable.columns[nextMapping.ys[0]] || "Y" : next.kind === "demo" ? CHART_TEMPLATES.find(item => item.id === id)!.yLabel : "数值");
        setSecondaryYLabel(nextTable.columns[nextMapping.ys[1]] || "右轴指标");
        const middleX = numericCell(nextTable.rows[Math.floor(nextTable.rows.length / 2)]?.[nextMapping.x]);
        setAnnotationX(middleX ?? 0.6);
        const errorColumns = Object.values(nextMapping.errors).map(index => nextTable.columns[index]);
        setErrorInput(errorColumns.length ? "summary" : "replicates");
        setErrorMeasure(errorColumns.length && errorColumns.every(name => /sem|标准误|standard.?error/i.test(name)) ? "SEM" : "SD");
        setFileError("");
        setExportError("");
    }

    function chooseTemplate(id: TemplateId) {
        if (id === selected) return;
        const next = CHART_TEMPLATES.find(item => item.id === id)!;
        setSelected(id);
        setCumulative(false);
        setPanelChart("bar");
        setWidth(id === "multi-panel" || id === "schematic" ? 900 : 680);
        setHeight(id === "multi-panel" ? 620 : 420);
        setTitle(id === "line" ? "循环性能比较" : next.name);
        if (source.kind === "demo") bindTable({ name: `${next.name}示例`, kind: "demo", sheets: [{ name: "示例数据", matrix: next.demo }] }, 0, true, id, "bar");
        else bindTable(source, sheetIndex, hasHeader, id, "bar");
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
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
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
        setMapping(current => ({ ...current, ys: selected === "box" || selected === "violin" ? current.ys.includes(index) ? [] : [index] : current.ys.includes(index) ? current.ys.filter(y => y !== index) : [...current.ys, index].sort((a, b) => a - b) }));
        setExportError("");
    }

    function applyRecommendation(id: TemplateId, nextMapping: ColumnMapping) {
        const next = CHART_TEMPLATES.find(item => item.id === id)!;
        setSelected(id); setMapping(nextMapping); setPanelChart("bar"); setCumulative(false);
        setXLabel(table.columns[nextMapping.x] || next.xLabel);
        setYLabel(id === "histogram" ? "样本数" : table.columns[nextMapping.ys[0]] || next.yLabel);
        setTitle(source.kind === "file" ? source.name.replace(/\.[^.]+$/, "") : next.name);
        setFileError(""); setExportError("");
        requestAnimationFrame(() => document.getElementById("template-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    useImperativeHandle(ref, () => ({ loadData(name, matrix, id, nextMapping) {
        const next = CHART_TEMPLATES.find(item => item.id === id)!;
        bindTable({ name, kind: "file", sheets: [{ name: "已处理 XY 数据", matrix }] }, 0, true, id);
        setSelected(id); setMapping(nextMapping); setPanelChart("bar"); setCumulative(false);
        setTitle(name); setXLabel(String(matrix[0]?.[nextMapping.x] ?? next.xLabel));
        setYLabel(id === "histogram" ? "样本数" : String(matrix[0]?.[nextMapping.ys[0]] ?? next.yLabel));
    } }));
    function exportSvg() {
        if (!chartRef.current) throw new Error("请先完成数据绑定，等待图表呈现。");
        const svg = chartRef.current.getEchartsInstance().renderToSVGString();
        const desc = document.createElementNS("http://www.w3.org/2000/svg", "desc");
        desc.textContent = `${source.kind === "demo" ? "演示数据；" : "用户提供数据；"}${caption || "统计图注由用户核对。"}`;
        return svg.replace(/(<svg\b[^>]*>)/, root => root + new XMLSerializer().serializeToString(desc));
    }

    return (
        <section id="data-templates" className="template-studio" hidden={!active} aria-labelledby="template-studio-title">
            <div className="template-intro">
                <div><span className="template-eyebrow"><Layers3 size={14} /> BASIC CHARTS / 基础绘图</span><h2 id="template-studio-title">从一个好模板开始<span>。</span></h2><p>选择通用图表并绑定数据；按具体论文图例替换数据，请进入“论文图例模板”。</p></div>
                <div className="template-intro-note"><span><Sparkles size={15} /> 为科研表达而设计</span><p>{CHART_TEMPLATES.length} 类科研模板<br />真实数据由你提供</p></div>
            </div>

            <div className="template-advisor-upload"><label htmlFor="template-data-upload"><UploadCloud size={16} />{loading ? "正在读取…" : "上传数据，获得绘图建议"}</label><span>{source.kind === "demo" ? "当前使用演示数据" : source.name} · 下方可切换工作表与列名设置</span></div>
            <DataAdvisor key={`${source.name}-${sheetIndex}-${hasHeader}`} table={table} mapping={mapping} demo={source.kind === "demo"} disabled={loading || exporting} onApply={applyRecommendation} />
            <div className="template-catalog-toolbar">
                <div className="template-category-tabs" role="group" aria-label="模板分类">{(["全部", ...TEMPLATE_CATEGORIES] as const).map(item => <button key={item} type="button" aria-pressed={category === item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}<small>{item === "全部" ? CHART_TEMPLATES.length : CHART_TEMPLATES.filter(template => template.category === item).length}</small></button>)}</div>
                <label className="template-search"><Search size={15} /><input aria-label="搜索模板" placeholder="搜索图表或用途" value={search} onChange={event => setSearch(event.target.value)} /></label>
            </div>
            <div className="template-catalog-meta"><span>显示 {filtered.length} / {CHART_TEMPLATES.length} 类模板</span><span>下滑浏览全部模板 · 当前选择：{template.name}</span></div>
            <div className="template-gallery" aria-label="选择图表模板">
                {filtered.map(item => <button key={item.id} type="button" className={`template-card${selected === item.id ? " is-selected" : ""}`} aria-pressed={selected === item.id} onClick={() => chooseTemplate(item.id)} disabled={loading}>
                    <div className={`template-card-art template-card-art--${item.id}`}><span className="template-card-number">{String(CHART_TEMPLATES.indexOf(item) + 1).padStart(2, "0")}</span><span className="template-card-tag">{item.tag}</span><Image src={`/data-templates/${item.id}.svg`} width={340} height={210} alt={`${item.name}示例预览`} /></div>
                    <div className="template-card-body"><span className="template-eyebrow">{item.english}</span><h3>{item.name}</h3><p>{item.description}</p><div className="template-card-bottom"><small>{item.requirement}</small><span>{selected === item.id ? <><Check size={14} /> 已选择</> : <><ArrowRight size={15} /> 使用模板</>}</span></div></div>
                </button>)}
            </div>

            {!filtered.length && <p className="template-search-empty">没有匹配的模板，请换个关键词或选择“全部”。</p>}
            <div className="template-flow" aria-label="模板使用流程"><span className="is-complete"><Check size={14} /> 01 选择模板</span><i /><span><FileSpreadsheet size={14} /> 02 导入与绑定</span><i /><span><ArrowDownToLine size={14} /> 03 预览与导出</span></div>

            <div id="template-editor" className="template-editor">
                <section className="template-input-panel template-glass" aria-labelledby="template-data-title">
                    <div className="template-section-heading"><span className="template-section-icon"><FileSpreadsheet size={18} /></span><div><h3 id="template-data-title">让模板读懂你的数据</h3><p>当前模板：{template.name}</p></div></div>
                    <p className="template-input-guide">{template.guide}</p>
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
                    <label className="template-field">{selected === "histogram" ? "原始样本数值列" : isGraph(selected) ? "起点 / 起始步骤列" : (isNumericX(selected) || selected === "multi-panel" && panelChart === "line") ? "X 轴数值列" : selected === "radar" ? "指标名称列" : selected === "trend" ? "时间标签列" : "类别 / 行名称列"}<div className="template-select-wrap"><select value={mapping.x} onChange={event => { const x = Number(event.target.value); setMapping(current => ({ ...current, x, ys: isSpatial(selected) || isGraph(selected) ? current.ys.map(y => y === x ? -1 : y) : current.ys.filter(y => y !== x) })); setXLabel(table.columns[x]); }}>{table.columns.map((name, index) => <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>
                    {selected === "histogram" && <p className="template-hint">当前列为原始样本数值；直方图不需要绑定 Y 列。</p>}
                    {selected === "multi-panel" && <div className="template-segment" role="group" aria-label="分面图形">{(["bar", "line"] as const).map(kind => <button type="button" key={kind} aria-pressed={panelChart === kind} className={panelChart === kind ? "is-active" : ""} onClick={() => { setPanelChart(kind); if (source.kind === "demo") bindTable({ name: kind === "line" ? "参数扫描示例" : "分面比较示例", kind: "demo", sheets: [{ name: "示例数据", matrix: kind === "line" ? PANEL_SWEEP_DEMO : template.demo }] }, 0, true, selected, kind); else bindTable(source, sheetIndex, hasHeader, selected, kind); }}>{kind === "bar" ? "柱状比较" : "参数扫描折线"}</button>)}</div>}
                    {selected === "error-bar" && <><div className="template-segment" role="group" aria-label="误差数据格式"><button type="button" aria-pressed={errorInput === "replicates"} className={errorInput === "replicates" ? "is-active" : ""} onClick={() => setErrorInput("replicates")}>重复实验列</button><button type="button" aria-pressed={errorInput === "summary"} className={errorInput === "summary" ? "is-active" : ""} onClick={() => setErrorInput("summary")}>均值＋误差列</button></div><label className="template-field">误差条含义<div className="template-select-wrap"><select value={errorMeasure} onChange={event => setErrorMeasure(event.target.value as ErrorMeasure)}><option value="SD">SD · 样本标准差</option><option value="SEM">SEM · 均值标准误</option></select><ChevronDown size={14} /></div></label><p className="template-hint">{errorInput === "replicates" ? "每行代表一个样品，选择至少 2 列独立重复实验。SD 使用 n−1 分母；SEM = SD / √n。" : "每行代表一个样品。误差列应填写所选 SD 或 SEM 的非负数值，此处不进行自动换算。"}</p></>}
                    {isSpatial(selected) || isGraph(selected) ? <div>
                        {(isSpatial(selected) ? ["Y 坐标列", "Z 坐标列"] : selected === "network" ? ["终点列", "权重列（可选）"] : ["后续步骤列"]).map((label, position) => <label className="template-field" key={label}>{label}<div className="template-select-wrap"><select value={mapping.ys[position] === -1 ? "" : mapping.ys[position] ?? ""} onChange={event => { const value = event.target.value; setMapping(current => { const ys = [...current.ys]; if (!value && selected === "network" && position === 1) ys.splice(position, 1); else ys[position] = value === "" ? -1 : Number(value); return { ...current, ys }; }); }}><option value="">{position === 1 && selected === "network" ? "无权重 · 每条连接等宽" : "请选择数据列"}</option>{table.columns.map((name, index) => index !== mapping.x && !mapping.ys.some((y, i) => y === index && i !== position) && <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>)}
                    </div> : <fieldset className="template-y-fields" hidden={selected === "histogram"}><legend>{selected === "box" || selected === "violin" ? "原始样本 Y 列（选择一列）" : selected === "error-bar" ? errorInput === "replicates" ? "重复实验列" : "均值列" : selected === "radar" ? "方法 / 样品数值列" : selected === "heatmap" ? "矩阵数值列" : "Y 数据列（可多选）"}</legend>{table.columns.map((name, index) => index !== mapping.x && <label key={index} className="template-column-choice"><span><input type="checkbox" checked={mapping.ys.includes(index)} onChange={() => toggleY(index)} />{name}</span><small>{table.rows.some(row => numericCell(row[index]) !== null) ? "数值" : "文本"}</small></label>)}</fieldset>}
                    {selected === "error-bar" && errorInput === "summary" && mapping.ys.map(y => <label className="template-field" key={y}>{table.columns[y]} · 误差列<div className="template-select-wrap"><select value={mapping.errors[y] ?? ""} onChange={event => setMapping(current => ({ ...current, errors: { ...current.errors, [y]: Number(event.target.value) } }))}><option value="" disabled>请选择误差列</option>{table.columns.map((name, index) => index !== mapping.x && !mapping.ys.includes(index) && <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>)}
                    {result.error && <p className="template-notice template-notice--error" role="alert">{result.error}</p>}
                    {!!result.data?.skipped && <div className="template-notice" role="status"><strong>已跳过 {result.data.skipped} 行不完整数据</strong>{result.data.warnings.map(message => <p key={message}>{message}</p>)}</div>}
                </section>

                <div className="template-output-column">
                    <section className="template-preview-panel template-glass" aria-labelledby="template-preview-title">
                        <div className="template-preview-heading"><div><span className="template-eyebrow">PUBLICATION CANVAS</span><h3 id="template-preview-title">你的图表，正在成形</h3></div><span className={`template-data-badge${source.kind === "demo" ? " is-demo" : ""}`}><i />{source.kind === "demo" ? "示例 · 非真实实验结果" : "你的实验数据"}</span></div>
                        <div className="template-preview-controls"><button type="button" aria-pressed={!actualPreview} onClick={() => setActualPreview(false)}>适应窗口</button><button type="button" aria-pressed={actualPreview} onClick={() => setActualPreview(true)}>原始尺寸</button><span>预览缩放不改变导出规格</span></div><div className="template-chart-frame"><div className="template-chart-scroll" ref={previewRef}>{active && option ? <div style={{ width: chartWidth * previewScale, height: chartHeight * previewScale, flex: "0 0 auto" }}><div style={{ width: chartWidth, height: chartHeight, transform: `scale(${previewScale})`, transformOrigin: "top left" }}><ReactECharts ref={chartRef} option={option} opts={{ renderer: "svg", width: chartWidth, height: chartHeight }} style={{ width: chartWidth, height: chartHeight }} notMerge /></div></div> : <div className="template-chart-empty"><SlidersHorizontal size={30} /><strong>完成列绑定后，图表会在这里呈现</strong><p>{result.error}</p></div>}</div></div>
                        <p className="template-chart-mobile-hint">预览自动适应窗口；切换原始尺寸可滑动查看细节。</p>
                        <div className="template-chart-footer"><span>{result.data ? isGraph(selected) ? `${result.data.x.length} 个节点 · ${result.data.edges?.length} 条连接` : isSpatial(selected) ? `${result.data.x.length} 个顶点 · X / Y / Z 坐标` : result.data.samples ? `${result.data.samples.reduce((sum, group) => sum + group.values.length, 0)} 个真实样本 · ${result.data.samples.length} 组` : `${result.data.x.length} ${isNumericX(selected) ? "个数据点" : "行数据"} · ${result.data.series.length} 组数据` : "等待有效数据"}{selected === "error-bar" && result.data ? ` · ±${errorMeasure}` : ""}</span><span>{chartWidth} × {chartHeight} px</span></div>
                        <PublicationExport width={chartWidth} height={chartHeight} settings={exportSettings} onChange={setExportSettings} getSvg={exportSvg} filename={`${title}${source.kind === "demo" ? "-示例" : ""}`} disabled={!result.data || loading} onBusy={setExporting} revision={option} extraIssues={[
                            ...(source.kind === "demo" ? [{ level: "warning" as const, message: "当前为演示数据，不是真实实验结果。" }] : []),
                            ...(selected === "dual-axis" ? [{ level: "warning" as const, message: "双 Y 轴使用独立刻度，请勿据曲线高度判断相关或比较大小。" }] : []),
                            ...(selected === "error-bar" && !caption.trim() ? [{ level: "warning" as const, message: "请补充统计图注：独立样本量、误差含义和实验重复类型。" }] : []),
                            ...(result.data?.skipped ? [{ level: "warning" as const, message: `绘图跳过 ${result.data.skipped} 行，请对照原始数据检查。` }] : []),
                        ]} />
                        {exportError && <p className="template-notice template-notice--error" role="alert">{exportError}</p>}
                    </section>

                    <section className="template-style-panel template-glass" aria-labelledby="template-style-title">
                        <div className="template-section-heading"><span className="template-section-icon"><Palette size={18} /></span><div><h3 id="template-style-title">最后一点，按你的风格</h3><p>样式调整会立即同步到预览和导出文件。</p></div></div>
                        <div className="template-style-presets" role="group" aria-label="论文图表样式">{([{ id: "accessible", name: "色觉友好", colors: ["#0072B2", "#D55E00", "#009E73"] }, { id: "journal", name: "期刊简洁", colors: ["#38679b", "#c77972", "#64958c"] }, { id: "soft", name: "柔和对比", colors: ["#788bcc", "#d69baf", "#7dafb1"] }, { id: "mono", name: "黑白打印", colors: ["#282828", "#696969", "#a0a0a0"] }] as const).map(item => <button type="button" key={item.id} aria-pressed={palette === item.id} className={palette === item.id ? "is-active" : ""} onClick={() => setPalette(item.id)}><span>{item.colors.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>{item.name}{palette === item.id && <Check size={13} />}</button>)}</div>
                        <div className="template-style-grid"><label className="template-field template-field--wide">图表标题<input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} /></label><label className="template-field">X 轴标题<input value={xLabel} onChange={event => setXLabel(event.target.value)} maxLength={60} /></label><label className="template-field">Y 轴标题<input value={yLabel} onChange={event => setYLabel(event.target.value)} maxLength={60} /></label><label className="template-field">字体<div className="template-select-wrap"><select value={fontFamily} onChange={event => setFontFamily(event.target.value)}><option value="Arial">Arial · 无衬线</option><option value="Times New Roman">Times New Roman · 衬线</option><option value="sans-serif">系统无衬线</option></select><ChevronDown size={14} /></div></label><label className="template-field">最终字号 (pt)<input type="number" min={5} max={16} step={0.5} value={fontSize} onChange={event => setFontSize(Number(event.target.value))} onBlur={() => setFontSize(safeFontSize)} /></label><label className="template-field">画布宽度 (px)<input type="number" min={420} max={1600} step={20} value={width} onChange={event => setWidth(Number(event.target.value))} onBlur={() => setWidth(chartWidth)} /></label><label className="template-field">画布高度 (px)<input type="number" min={320} max={1000} step={20} value={height} onChange={event => setHeight(Number(event.target.value))} onBlur={() => setHeight(chartHeight)} /></label></div>
                        <label className="template-field">统计图注（保存在 SVG 描述中）<input value={caption} maxLength={300} onChange={event => setCaption(event.target.value)} placeholder="如：n=6 独立实验；误差条为 SD；单位见轴标题" /></label>
                        {selected === "dual-axis" && <label className="template-field">右侧 Y 轴标题<input value={secondaryYLabel} onChange={event => setSecondaryYLabel(event.target.value)} maxLength={60} /></label>}
                        {selected === "concept" && <div className="template-style-grid"><label className="template-field">标注位置 X<input type="number" step="any" value={annotationX} onChange={event => setAnnotationX(Number(event.target.value))} /></label><label className="template-field">标注文字<input value={annotationText} onChange={event => setAnnotationText(event.target.value)} maxLength={40} /></label></div>}
                        {isSpatial(selected) && <div className="template-camera"><label>方位角 {yaw}°<input type="range" min={-180} max={180} value={yaw} onChange={event => setYaw(Number(event.target.value))} /></label><label>仰角 {pitch}°<input type="range" min={-80} max={80} value={pitch} onChange={event => setPitch(Number(event.target.value))} /></label><p>三维坐标以正交投影呈现，导出保留当前视角。</p></div>}
                        <div className="template-style-switches"><label className="template-checkbox"><input type="checkbox" checked={showGrid} onChange={event => setShowGrid(event.target.checked)} /> 显示参考网格</label>{(isBar(selected) || selected === "network") && <label className="template-checkbox"><input type="checkbox" checked={showValues} onChange={event => setShowValues(event.target.checked)} /> 标注数值</label>}</div>
                        {selected === "trend" && <label className="template-checkbox"><input type="checkbox" checked={cumulative} onChange={event => setCumulative(event.target.checked)} />按输入时间顺序计算累计量</label>}
                    </section>
                </div>
            </div>
            <p className="template-bottom-note">图表模板参考通用科研绘图方法独立实现。示例数据仅用于演示布局，不代表真实实验结果。</p>
        </section>
    );
}
