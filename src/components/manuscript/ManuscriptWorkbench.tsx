"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Download, ExternalLink, FileText, Loader2, Search, ShieldCheck, SlidersHorizontal, UploadCloud } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { JOURNAL_PRESETS, type JournalPreset, type ManuscriptOptions } from "@/lib/manuscript/journals";
import type { FormattedManuscript } from "@/lib/manuscript/format-docx";
import "./manuscript.css";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export default function ManuscriptWorkbench() {
    const [search, setSearch] = useState("");
    const [field, setField] = useState("全部领域");
    const [selected, setSelected] = useState<JournalPreset | null>(null);
    const [options, setOptions] = useState<ManuscriptOptions>(JOURNAL_PRESETS[0].options);
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<FormattedManuscript | null>(null);
    const [downloadUrl, setDownloadUrl] = useState("");
    const [advanced, setAdvanced] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const jobRef = useRef(0);
    const filtered = useMemo(() => JOURNAL_PRESETS.filter(item => (field === "全部领域" || item.field === field) && `${item.name} ${item.publisher} ${item.field}`.toLowerCase().includes(search.trim().toLowerCase())), [search, field]);

    useEffect(() => {
        if (!result) return;
        const url = URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
        setDownloadUrl(url);
        return () => { URL.revokeObjectURL(url); setDownloadUrl(""); };
    }, [result]);

    function chooseJournal(journal: JournalPreset) {
        jobRef.current++;
        setSelected(journal); setOptions({ ...journal.options }); setResult(null); setError(""); setAdvanced(false);
    }
    function selectFile(next: File | undefined) {
        if (!next) return;
        setResult(null); setError("");
        if (!/\.docx$/i.test(next.name)) { setFile(null); setError("请上传 .docx 文件。旧版 .doc 请先在 Word 中另存为 .docx。"); return; }
        if (next.size > MAX_FILE_BYTES) { setFile(null); setError("文件超过 20 MB，请压缩内嵌图片后重试。"); return; }
        setFile(next);
    }
    function updateOptions(patch: Partial<ManuscriptOptions>) { setOptions(value => ({ ...value, ...patch })); setResult(null); setError(""); }
    async function format() {
        if (!selected || !file || busy) return;
        const job = ++jobRef.current;
        setBusy(true); setError(""); setResult(null);
        try {
            const { formatManuscript } = await import("@/lib/manuscript/format-docx");
            const output = await formatManuscript(await file.arrayBuffer(), selected.id, options);
            if (job === jobRef.current) setResult(output);
        } catch (cause) {
            if (job === jobRef.current) setError(cause instanceof Error ? cause.message : "排版未完成，请重新上传文档后重试。");
        } finally { if (job === jobRef.current) setBusy(false); }
    }
    const outputName = file && selected ? `${file.name.replace(/\.docx$/i, "")}-${selected.id}-formatted.docx` : "formatted-manuscript.docx";

    return <main className="resource-page manuscript-page">
        <header className="resource-hero">
            <div>
                <span className="resource-eyebrow"><BookOpen size={13} /> MANUSCRIPT STUDIO</span>
                <h1>论文排版</h1>
                <p>选择期刊，上传 Word，将正文整理为清晰一致的投稿稿件。每份方案附官方指南，明确区分期刊要求与可调整的整理预设。</p>
                <div className="manuscript-hero-chips"><span className="resource-chip"><ShieldCheck size={12} /> 文件仅在本机处理</span><span className="resource-chip">8 个期刊方案</span><span className="resource-chip">输出可编辑 Word</span></div>
            </div>
            <div className="manuscript-paper-art" aria-hidden="true"><div className="manuscript-paper-art__sheet"><span>RESEARCH MANUSCRIPT</span><strong>From research<br />to submission.</strong><i /><i /><i /><div className="manuscript-paper-art__chart"><b /><b /><b /><b /><b /></div><i /><i /></div><span className="manuscript-paper-art__stamp"><CheckCircle2 size={17} /> .docx</span></div>
        </header>
        <div className="manuscript-steps" aria-label="排版步骤"><span><b>01</b> 选择目标期刊</span><ArrowRight size={14} /><span><b>02</b> 上传原稿并确认参数</span><ArrowRight size={14} /><span><b>03</b> 下载并复核排版结果</span></div>
        <div className="resource-toolbar">
            <label className="manuscript-search"><Search size={15} /><input aria-label="搜索期刊" placeholder="搜索期刊或出版社…" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <select aria-label="期刊领域" value={field} onChange={event => setField(event.target.value)}>{["全部领域", "综合科研", "材料与能源", "生命科学"].map(item => <option key={item}>{item}</option>)}</select>
            <span className="resource-meta">{filtered.length} 个方案 · 官方指南核对于 2026.10.03</span>
        </div>
        {filtered.length ? <div className="resource-grid">{filtered.map(journal => <button className="resource-card manuscript-journal-card" type="button" key={journal.id} onClick={() => chooseJournal(journal)} aria-label={`选择 ${journal.name} 进行论文排版`}>
            <div className="manuscript-card-top"><span className={`resource-card-icon manuscript-monogram manuscript-monogram--${journal.accent}`}>{journal.monogram}</span><span className="resource-chip">{journal.field}</span></div>
            <h2>{journal.name}</h2><span className="resource-meta">{journal.publisher}</span><p>{journal.summary}</p>
            <div className="resource-card-footer"><span className="resource-chip">{journal.policy}</span><span>选择并排版 <ArrowRight size={13} /></span></div>
        </button>)}</div> : <div className="resource-empty">未找到匹配期刊，试试其他名称或领域。</div>}
        <p className="manuscript-scope-note">当前提供投稿稿件的版式整理。字体、字号、纸张和页边距可按需要调整；参考文献、章节顺序和图片内容保留，期刊的最终出版排版由出版社完成。</p>

        <ResourceDialog open={!!selected} onClose={() => { if (!busy) setSelected(null); }} title={selected?.name ?? "论文排版"} eyebrow="JOURNAL FORMATTING" footer={<>
            <button className="resource-button" type="button" disabled={busy} onClick={() => setSelected(null)}>返回期刊列表</button>
            {result && downloadUrl ? <a className="resource-button resource-button--primary" href={downloadUrl} download={outputName}><Download size={15} /> 下载排版 Word</a> : <button className="resource-button resource-button--primary" type="button" disabled={!file || busy} onClick={() => void format()}>{busy ? <Loader2 size={15} className="manuscript-spinner" /> : <SlidersHorizontal size={15} />}{busy ? "正在本地排版…" : "生成排版 Word"}</button>}
        </>}>
            {selected && <>
                <div className="manuscript-policy"><span className="resource-chip">{selected.policy}</span><p>{selected.summary}</p><ul className="resource-detail-list">{selected.officialRequirements.map(item => <li key={item}>{item}</li>)}</ul><div className="manuscript-source-links"><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> 官方作者指南</a>{selected.templateUrl && <a href={selected.templateUrl} target="_blank" rel="noopener noreferrer"><FileText size={13} /> 官方模板入口</a>}<span>核对日期 {selected.checkedOn}</span></div></div>
                <h3>上传论文原稿</h3>
                <input ref={inputRef} className="manuscript-file-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="上传论文 Word" disabled={busy} onChange={event => { selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                <button className={`manuscript-upload ${file ? "manuscript-upload--ready" : ""}`} type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
                    {file ? <FileText size={26} /> : <UploadCloud size={28} />}<strong>{file ? file.name : "选择论文 Word 文件"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · 点击更换文件` : ".docx · 最大 20 MB · 不上传到服务器"}</span>
                </button>
                <div className="manuscript-preset-summary"><span>{options.paper}</span><span>{options.font} · {options.fontSize} pt</span><span>{options.lineSpacing} 倍行距</span><span>{options.marginCm} cm 页边距</span></div>
                <button className="manuscript-options-toggle" type="button" aria-expanded={advanced} disabled={busy} onClick={() => setAdvanced(value => !value)}><SlidersHorizontal size={14} /> {advanced ? "收起排版参数" : "调整排版参数"}<span>工作台预设可修改</span></button>
                {advanced && <fieldset className="manuscript-options" disabled={busy}>
                    <legend>正文排版参数</legend>
                    <label>纸张<select value={options.paper} onChange={event => updateOptions({ paper: event.target.value as ManuscriptOptions["paper"] })}><option>A4</option><option>Letter</option></select></label>
                    <label>英文字体<select value={options.font} onChange={event => updateOptions({ font: event.target.value as ManuscriptOptions["font"] })}><option>Times New Roman</option><option>Arial</option><option>Calibri</option></select></label>
                    <label>正文大小（pt）<input type="number" min={9} max={16} step={.5} value={options.fontSize} onChange={event => updateOptions({ fontSize: Number(event.target.value) })} /></label>
                    <label>行距<select value={options.lineSpacing} onChange={event => updateOptions({ lineSpacing: Number(event.target.value) as ManuscriptOptions["lineSpacing"] })}><option value={1}>单倍</option><option value={1.5}>1.5 倍</option><option value={2}>双倍</option></select></label>
                    <label>页边距（cm）<input type="number" min={1.5} max={3.5} step={.01} value={options.marginCm} onChange={event => updateOptions({ marginCm: Number(event.target.value) })} /></label>
                    <label className="manuscript-checkbox"><input type="checkbox" checked={options.singleColumn} onChange={event => updateOptions({ singleColumn: event.target.checked })} /> 统一单栏</label>
                    <label className="manuscript-checkbox"><input type="checkbox" checked={options.lineNumbers} onChange={event => updateOptions({ lineNumbers: event.target.checked })} /> 连续行号</label>
                    <label className="manuscript-checkbox"><input type="checkbox" checked={options.pageNumbers} onChange={event => updateOptions({ pageNumbers: event.target.checked })} /> 添加缺少的页码</label>
                    <label className="manuscript-checkbox"><input type="checkbox" checked={options.preserveLandscape} onChange={event => updateOptions({ preserveLandscape: event.target.checked })} /> 保留横向章节</label>
                </fieldset>}
                <p className="manuscript-preservation">保留正文、图片、表格、公式、引文域和修订记录。表格、公式及图注的局部字号保持原样；输出为一份新文件，原稿不改写。</p>
                {error && <p className="manuscript-error" role="alert">{error}</p>}
                {busy && <p className="manuscript-progress" role="status">正在读取文档并应用排版，请保留此页面。</p>}
                {result && <div className="manuscript-result" role="status">
                    <h3><CheckCircle2 size={17} /> 排版完成，可以下载</h3>
                    <div className="manuscript-result-stats"><span><b>{result.report.paragraphCount}</b> 段落</span><span><b>{result.report.tableCount}</b> 表格</span><span><b>{result.report.imageCount}</b> 图片资源</span><span><b>{result.report.equationCount}</b> 公式</span></div>
                    <h3>本次已应用</h3><ul className="resource-detail-list">{result.report.changes.map(item => <li key={item}>{item}</li>)}</ul>
                    {result.report.warnings.length > 0 && <><h3>文档中的注意项</h3><ul className="resource-detail-list">{result.report.warnings.map(item => <li key={item}>{item}</li>)}</ul></>}
                    <h3>投稿前由你复核</h3><ul className="resource-detail-list">{result.report.checks.map(item => <li key={item}>{item}</li>)}</ul>
                </div>}
            </>}
        </ResourceDialog>
    </main>;
}
