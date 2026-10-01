"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as XLSX from "xlsx";
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, FileSpreadsheet, FlaskConical, Layers3, Loader2, Palette, SlidersHorizontal, Sparkles, UploadCloud } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { buildTemplateData, CHART_TEMPLATES, matrixToCsv, numericCell, parseTemplateTable, suggestMapping, type ColumnMapping, type ErrorInput, type ErrorMeasure, type TemplateId } from "@/lib/data-processing/templates";
import { createTemplateOption, type PublicationStyle } from "@/lib/data-processing/template-chart";
import "./template-studio.css";

type Sheet = { name: string; matrix: unknown[][] };
type Source = { name: string; kind: "demo" | "file"; sheets: Sheet[] };
const initial = CHART_TEMPLATES[0];

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

function TemplateThumbnail({ type }: { type: TemplateId }) {
    const colors = ["#788dcc", "#cc98af", "#7aa6a8"];
    return <svg viewBox="0 0 340 170" aria-hidden="true" focusable="false">
        {[47, 82, 117].map(y => <path key={y} d={`M 42 ${y} H 316`} stroke="#e7e4ef" strokeDasharray="3 5" />)}
        <path d="M42 30V143H316" stroke="#bcb5ce" fill="none" />
        {type === "line" ? <>
            {[["M42 48 L90 52 L136 63 L182 69 L228 84 L274 98 L316 102", colors[0]], ["M42 48 L90 68 L136 79 L182 100 L228 103 L274 121 L316 129", colors[1]], ["M42 48 L90 61 L136 73 L182 85 L228 95 L274 106 L316 118", colors[2]]].map(([path, color]) => <path key={color} d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />)}
            {[42, 90, 136, 182, 228, 274, 316].map((x, i) => <circle key={x} cx={x} cy={[48, 52, 63, 69, 84, 98, 102][i]} r="3.5" fill={colors[0]} stroke="#fff" />)}
        </> : type === "grouped-bar" ? <>
            {[0, 1, 2, 3].flatMap(group => colors.map((color, series) => { const height = 86 - group * 10 - series * 15; return <rect key={`${group}-${series}`} x={55 + group * 67 + series * 16} y={143 - height} width="12" height={height} rx="2" fill={color} />; }))}
        </> : <>
            {[65, 130, 195, 260].map((x, i) => { const y = 94 - i * 15; const error = [13, 9, 12, 17][i]; return <g key={x}><rect x={x} y={y} width="30" height={143 - y} rx="3" fill={colors[0]} opacity={0.55 + i * 0.12} /><path d={`M${x + 15} ${y - error}V${y + error}M${x + 8} ${y - error}H${x + 22}M${x + 8} ${y + error}H${x + 22}`} fill="none" stroke="#675a7c" strokeWidth="1.5" /></g>; })}
        </>}
        {[0, 1, 2].map(i => <g key={i}><rect x={107 + i * 52} y="12" width="11" height="5" rx="2" fill={colors[i]} /><path d={`M${122 + i * 52} 15h19`} stroke="#bcb5ce" strokeWidth="2" /></g>)}
    </svg>;
}

export default function TemplateStudio({ active }: { active: boolean }) {
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
    const [fontSize, setFontSize] = useState(13);
    const [width, setWidth] = useState(680);
    const [height, setHeight] = useState(420);
    const [showGrid, setShowGrid] = useState(false);
    const [showValues, setShowValues] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [fileError, setFileError] = useState("");
    const [exportError, setExportError] = useState("");
    const chartRef = useRef<ReactECharts>(null);
    const template = CHART_TEMPLATES.find(item => item.id === selected)!;
    const table = useMemo(() => parseTemplateTable(source.sheets[sheetIndex]?.matrix ?? [], hasHeader), [source, sheetIndex, hasHeader]);
    const result = useMemo(() => buildTemplateData(table, mapping, selected, errorInput, errorMeasure), [table, mapping, selected, errorInput, errorMeasure]);
    const chartWidth = Number.isFinite(width) && width >= 420 && width <= 1600 ? width : 680;
    const chartHeight = Number.isFinite(height) && height >= 320 && height <= 1000 ? height : 420;
    const safeFontSize = Number.isFinite(fontSize) && fontSize >= 10 && fontSize <= 22 ? fontSize : 13;
    const option = useMemo(() => result.data ? createTemplateOption(result.data, selected, {
        title: `${title}${source.kind === "demo" ? " · 示例数据" : ""}`, xLabel, yLabel, fontFamily, fontSize: safeFontSize, palette, showGrid, showValues, errorMeasure,
    }) : null, [result.data, selected, title, source.kind, xLabel, yLabel, fontFamily, safeFontSize, palette, showGrid, showValues, errorMeasure]);

    useEffect(() => {
        if (!active) return;
        const frame = requestAnimationFrame(() => chartRef.current?.getEchartsInstance()?.resize({ width: chartWidth, height: chartHeight }));
        return () => cancelAnimationFrame(frame);
    }, [active, chartWidth, chartHeight]);

    function bindTable(next: Source, nextSheet = 0, headers = true, id = selected) {
        const nextTable = parseTemplateTable(next.sheets[nextSheet]?.matrix ?? [], headers);
        const nextMapping = suggestMapping(nextTable, id);
        setSource(next);
        setSheetIndex(nextSheet);
        setHasHeader(headers);
        setMapping(nextMapping);
        setXLabel(nextTable.columns[nextMapping.x] || "X");
        setYLabel(next.kind === "demo" ? CHART_TEMPLATES.find(item => item.id === id)!.yLabel : "数值");
        const errorColumns = Object.values(nextMapping.errors).map(index => nextTable.columns[index]);
        setErrorInput(errorColumns.length ? "summary" : "replicates");
        setErrorMeasure(errorColumns.length && errorColumns.every(name => /sem|标准误|standard.?error/i.test(name)) ? "SEM" : "SD");
        setFileError("");
        setExportError("");
    }

    function chooseTemplate(id: TemplateId) {
        const next = CHART_TEMPLATES.find(item => item.id === id)!;
        setSelected(id);
        setTitle(id === "line" ? "循环性能比较" : next.name);
        if (source.kind === "demo") bindTable({ name: `${next.name}示例`, kind: "demo", sheets: [{ name: "示例数据", matrix: next.demo }] }, 0, true, id);
        else bindTable(source, sheetIndex, hasHeader, id);
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
        setMapping(current => ({ ...current, ys: current.ys.includes(index) ? current.ys.filter(y => y !== index) : [...current.ys, index].sort((a, b) => a - b) }));
        setExportError("");
    }

    async function exportChart(format: "svg" | "png") {
        if (!chartRef.current || !result.data || exporting) return;
        setExporting(true);
        setExportError("");
        try {
            const svg = chartRef.current.getEchartsInstance().renderToSVGString();
            const filename = (title.trim() || template.name).replace(/[\\/:*?"<>|]/g, "_") + (source.kind === "demo" ? "-示例" : "");
            const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
            if (format === "svg") downloadBlob(blob, `${filename}.svg`);
            else {
                const svgUrl = URL.createObjectURL(blob);
                try {
                    const image = new window.Image();
                    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("图表转换失败，请尝试 SVG 导出。")); image.src = svgUrl; });
                    const canvas = document.createElement("canvas");
                    canvas.width = chartWidth * 3;
                    canvas.height = chartHeight * 3;
                    const context = canvas.getContext("2d");
                    if (!context) throw new Error("浏览器无法生成 PNG，请使用 SVG 导出。");
                    context.fillStyle = "#fff";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG 导出失败。")), "image/png"));
                    downloadBlob(png, `${filename}.png`);
                } finally { URL.revokeObjectURL(svgUrl); }
            }
        } catch (error) { setExportError(error instanceof Error ? error.message : "导出失败，请重试。"); }
        finally { setExporting(false); }
    }

    return (
        <section id="data-templates" className="template-studio" hidden={!active} aria-labelledby="template-studio-title">
            <div className="template-intro">
                <div><span className="template-eyebrow"><Layers3 size={14} /> TEMPLATE COLLECTION / 数据模板</span><h2 id="template-studio-title">从一个好模板开始<span>。</span></h2><p>选择图表，绑定数据，让实验结果拥有清晰的表达。</p></div>
                <div className="template-intro-note"><span><Sparkles size={15} /> 为科研表达而设计</span><p>真实数据由你提供<br />图表结构与样式交给模板</p></div>
            </div>

            <div className="template-gallery" aria-label="选择图表模板">
                {CHART_TEMPLATES.map((item, index) => <button key={item.id} type="button" className={`template-card${selected === item.id ? " is-selected" : ""}`} aria-pressed={selected === item.id} onClick={() => chooseTemplate(item.id)} disabled={loading}>
                    <div className={`template-card-art template-card-art--${item.id}`}><span className="template-card-number">0{index + 1}</span><span className="template-card-tag">{item.tag}</span><TemplateThumbnail type={item.id} /></div>
                    <div className="template-card-body"><span className="template-eyebrow">{item.english}</span><h3>{item.name}</h3><p>{item.description}</p><div className="template-card-bottom"><small>{item.requirement}</small><span>{selected === item.id ? <><Check size={14} /> 已选择</> : <><ArrowRight size={15} /> 使用模板</>}</span></div></div>
                </button>)}
            </div>

            <div className="template-flow" aria-label="模板使用流程"><span className="is-complete"><Check size={14} /> 01 选择模板</span><i /><span><FileSpreadsheet size={14} /> 02 导入与绑定</span><i /><span><ArrowDownToLine size={14} /> 03 预览与导出</span></div>

            <div className="template-editor">
                <section className="template-input-panel template-glass" aria-labelledby="template-data-title">
                    <div className="template-section-heading"><span className="template-section-icon"><FileSpreadsheet size={18} /></span><div><h3 id="template-data-title">让模板读懂你的数据</h3><p>当前模板：{template.name}</p></div></div>
                    <label className={`template-upload${loading ? " is-loading" : ""}`} htmlFor="template-data-upload">
                        <input id="template-data-upload" type="file" accept=".csv,.xlsx,.xls" onChange={importFile} disabled={loading} className="sr-only" />
                        {loading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}<strong>{loading ? "正在读取表格…" : "导入自己的实验数据"}</strong><span>CSV / Excel · 最大 10 MB</span>
                    </label>
                    <div className="template-example-actions"><button type="button" onClick={() => bindTable({ name: `${template.name}示例`, kind: "demo", sheets: [{ name: "示例数据", matrix: template.demo }] })} disabled={loading}><FlaskConical size={14} /> 载入示例</button><button type="button" onClick={() => downloadBlob(new Blob([matrixToCsv(template.demo)], { type: "text/csv;charset=utf-8" }), `${template.name}-示例.csv`)}><ArrowDownToLine size={14} /> 下载示例表格</button></div>
                    {fileError && <p className="template-notice template-notice--error" role="alert">{fileError}</p>}
                    <div className="template-source-meta"><span>{source.kind === "demo" ? "示例数据" : "已导入"}</span><strong title={source.name}>{source.name}</strong><small>{table.rows.filter(row => row.some(cell => cell !== null && cell !== "")).length} 行 · {table.columns.length} 列</small></div>
                    {source.sheets.length > 1 && <label className="template-field">工作表<div className="template-select-wrap"><select value={sheetIndex} onChange={event => bindTable(source, Number(event.target.value), hasHeader)}>{source.sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}</option>)}</select><ChevronDown size={14} /></div></label>}
                    <label className="template-checkbox"><input type="checkbox" checked={hasHeader} onChange={event => bindTable(source, sheetIndex, event.target.checked)} /> 首行为列名</label>
                    <div className="template-table-wrap" tabIndex={0} aria-label="数据预览，可横向滚动"><table><thead><tr><th scope="col">行</th>{table.columns.map((name, index) => <th scope="col" key={index}>{name}</th>)}</tr></thead><tbody>{table.rows.slice(0, 4).map((row, index) => <tr key={index}><td>{table.firstDataRow + index}</td>{row.map((value, column) => <td key={column}>{value ?? "—"}</td>)}</tr>)}</tbody></table></div>

                    <div className="template-binding-heading"><SlidersHorizontal size={15} /><h4>数据列绑定</h4><span>即时预览</span></div>
                    <label className="template-field">{selected === "line" ? "X 轴数值列" : "类别 / 样品列"}<div className="template-select-wrap"><select value={mapping.x} onChange={event => { const x = Number(event.target.value); setMapping(current => ({ ...current, x, ys: current.ys.filter(y => y !== x) })); setXLabel(table.columns[x]); }}>{table.columns.map((name, index) => <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>
                    {selected === "error-bar" && <><div className="template-segment" role="group" aria-label="误差数据格式"><button type="button" aria-pressed={errorInput === "replicates"} className={errorInput === "replicates" ? "is-active" : ""} onClick={() => setErrorInput("replicates")}>重复实验列</button><button type="button" aria-pressed={errorInput === "summary"} className={errorInput === "summary" ? "is-active" : ""} onClick={() => setErrorInput("summary")}>均值＋误差列</button></div><label className="template-field">误差条含义<div className="template-select-wrap"><select value={errorMeasure} onChange={event => setErrorMeasure(event.target.value as ErrorMeasure)}><option value="SD">SD · 样本标准差</option><option value="SEM">SEM · 均值标准误</option></select><ChevronDown size={14} /></div></label><p className="template-hint">{errorInput === "replicates" ? "每行代表一个样品，选择至少 2 列独立重复实验。SD 使用 n−1 分母；SEM = SD / √n。" : "每行代表一个样品。误差列应填写所选 SD 或 SEM 的非负数值，此处不进行自动换算。"}</p></>}
                    <fieldset className="template-y-fields"><legend>{selected === "error-bar" ? errorInput === "replicates" ? "重复实验列" : "均值列" : "Y 数据列（可多选）"}</legend>{table.columns.map((name, index) => index !== mapping.x && <label key={index} className="template-column-choice"><span><input type="checkbox" checked={mapping.ys.includes(index)} onChange={() => toggleY(index)} />{name}</span><small>{table.rows.some(row => numericCell(row[index]) !== null) ? "数值" : "文本"}</small></label>)}</fieldset>
                    {selected === "error-bar" && errorInput === "summary" && mapping.ys.map(y => <label className="template-field" key={y}>{table.columns[y]} · 误差列<div className="template-select-wrap"><select value={mapping.errors[y] ?? ""} onChange={event => setMapping(current => ({ ...current, errors: { ...current.errors, [y]: Number(event.target.value) } }))}><option value="" disabled>请选择误差列</option>{table.columns.map((name, index) => index !== mapping.x && !mapping.ys.includes(index) && <option key={index} value={index}>{name}</option>)}</select><ChevronDown size={14} /></div></label>)}
                    {result.error && <p className="template-notice template-notice--error" role="alert">{result.error}</p>}
                    {!!result.data?.skipped && <div className="template-notice" role="status"><strong>已跳过 {result.data.skipped} 行不完整数据</strong>{result.data.warnings.map(message => <p key={message}>{message}</p>)}</div>}
                </section>

                <div className="template-output-column">
                    <section className="template-preview-panel template-glass" aria-labelledby="template-preview-title">
                        <div className="template-preview-heading"><div><span className="template-eyebrow">PUBLICATION CANVAS</span><h3 id="template-preview-title">你的图表，正在成形</h3></div><span className={`template-data-badge${source.kind === "demo" ? " is-demo" : ""}`}><i />{source.kind === "demo" ? "示例 · 非真实实验结果" : "你的实验数据"}</span></div>
                        <div className="template-chart-frame"><div className="template-chart-scroll">{active && option ? <ReactECharts ref={chartRef} option={option} opts={{ renderer: "svg", width: chartWidth, height: chartHeight }} style={{ width: chartWidth, height: chartHeight }} notMerge /> : <div className="template-chart-empty"><SlidersHorizontal size={30} /><strong>完成列绑定后，图表会在这里呈现</strong><p>{result.error}</p></div>}</div></div>
                        <p className="template-chart-mobile-hint">画布可左右滑动查看，导出尺寸保持不变。</p>
                        <div className="template-chart-footer"><span>{result.data ? `${result.data.x.length} ${selected === "line" ? "个数据点" : "组类别"} · ${result.data.series.length} 组数据` : "等待有效数据"}{selected === "error-bar" && result.data ? ` · ±${errorMeasure}` : ""}</span><span>{chartWidth} × {chartHeight} px</span></div>
                        <div className="template-export-row"><p><strong>准备好分享了吗？</strong><span>SVG 保留矢量路径与文字；PNG 导出 3 倍尺寸。</span></p><div><GlassButton variant="secondary" size="sm" disabled={!result.data || exporting || loading} onClick={() => exportChart("png")}><ArrowDownToLine size={14} /> PNG</GlassButton><GlassButton variant="primary" size="sm" disabled={!result.data || exporting || loading} onClick={() => exportChart("svg")}>{exporting ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />} 导出 SVG</GlassButton></div></div>
                        {exportError && <p className="template-notice template-notice--error" role="alert">{exportError}</p>}
                    </section>

                    <section className="template-style-panel template-glass" aria-labelledby="template-style-title">
                        <div className="template-section-heading"><span className="template-section-icon"><Palette size={18} /></span><div><h3 id="template-style-title">最后一点，按你的风格</h3><p>样式调整会立即同步到预览和导出文件。</p></div></div>
                        <div className="template-style-presets" role="group" aria-label="论文图表样式">{([{ id: "journal", name: "期刊简洁", colors: ["#38679b", "#c77972", "#64958c"] }, { id: "soft", name: "柔和对比", colors: ["#788bcc", "#d69baf", "#7dafb1"] }, { id: "mono", name: "黑白打印", colors: ["#282828", "#696969", "#a0a0a0"] }] as const).map(item => <button type="button" key={item.id} aria-pressed={palette === item.id} className={palette === item.id ? "is-active" : ""} onClick={() => setPalette(item.id)}><span>{item.colors.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>{item.name}{palette === item.id && <Check size={13} />}</button>)}</div>
                        <div className="template-style-grid"><label className="template-field template-field--wide">图表标题<input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} /></label><label className="template-field">X 轴标题<input value={xLabel} onChange={event => setXLabel(event.target.value)} maxLength={60} /></label><label className="template-field">Y 轴标题<input value={yLabel} onChange={event => setYLabel(event.target.value)} maxLength={60} /></label><label className="template-field">字体<div className="template-select-wrap"><select value={fontFamily} onChange={event => setFontFamily(event.target.value)}><option value="Arial">Arial · 无衬线</option><option value="Times New Roman">Times New Roman · 衬线</option><option value="sans-serif">系统无衬线</option></select><ChevronDown size={14} /></div></label><label className="template-field">字号 (px)<input type="number" min={10} max={22} value={fontSize} onChange={event => setFontSize(Number(event.target.value))} onBlur={() => setFontSize(safeFontSize)} /></label><label className="template-field">画布宽度 (px)<input type="number" min={420} max={1600} step={20} value={width} onChange={event => setWidth(Number(event.target.value))} onBlur={() => setWidth(chartWidth)} /></label><label className="template-field">画布高度 (px)<input type="number" min={320} max={1000} step={20} value={height} onChange={event => setHeight(Number(event.target.value))} onBlur={() => setHeight(chartHeight)} /></label></div>
                        <div className="template-style-switches"><label className="template-checkbox"><input type="checkbox" checked={showGrid} onChange={event => setShowGrid(event.target.checked)} /> 显示参考网格</label>{selected !== "line" && <label className="template-checkbox"><input type="checkbox" checked={showValues} onChange={event => setShowValues(event.target.checked)} /> 标注柱状数值</label>}</div>
                    </section>
                </div>
            </div>
            <p className="template-bottom-note">图表模板参考通用科研绘图方法独立实现。示例数据仅用于演示布局，不代表真实实验结果。</p>
        </section>
    );
}
