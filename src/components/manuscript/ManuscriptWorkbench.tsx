"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, BookOpen, CheckCircle2, Download, ExternalLink, FileText, Loader2, Search, ShieldCheck, SlidersHorizontal, UploadCloud } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { useActionLogin } from "@/components/auth/useActionLogin";
import { JOURNAL_PRESETS, type JournalPreset, type ManuscriptOptions } from "@/lib/manuscript/journals";
import type { FormattedManuscript } from "@/lib/manuscript/format-docx";
import "./manuscript.css";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export default function ManuscriptWorkbench() {
    const [search, setSearch] = useState("");
    const [field, setField] = useState("全部领域");
    const [selected, setSelected] = useState<JournalPreset | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [options, setOptions] = useState<ManuscriptOptions>(JOURNAL_PRESETS[0].options);
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [actionNotice, setActionNotice] = useState("");
    const [result, setResult] = useState<FormattedManuscript | null>(null);
    const [downloadUrl, setDownloadUrl] = useState("");
    const [advanced, setAdvanced] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const jobRef = useRef(0);
    const actionPending = useRef(false);
    const { checking, isAuthenticated, requestLogin, LoginPrompt } = useActionLogin();
    const filtered = useMemo(() => JOURNAL_PRESETS.filter(item => (field === "全部领域" || item.field === field) && `${item.name} ${item.publisher} ${item.field}`.toLowerCase().includes(search.trim().toLowerCase())), [search, field]);

    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get("journal");
        const journal = JOURNAL_PRESETS.find(item => item.id === id);
        if (journal) { setSelected(journal); setOptions({ ...journal.options }); setDialogVisible(true); }
    }, []);

    useEffect(() => {
        if (!result) return;
        const url = URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
        setDownloadUrl(url);
        return () => { URL.revokeObjectURL(url); setDownloadUrl(""); };
    }, [result]);

    function chooseJournal(journal: JournalPreset) {
        if (selected?.id === journal.id) { setDialogVisible(true); return; }
        jobRef.current++;
        setSelected(journal); setOptions({ ...journal.options }); setResult(null); setError(""); setActionNotice(""); setAdvanced(false); setDialogVisible(true);
    }
    function closeJournal() {
        if (busy || checking) return;
        setDialogVisible(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("journal");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    function returnTo(journal: JournalPreset) { return "/paper-formatting?journal=" + encodeURIComponent(journal.id); }
    async function chooseFileAfterLogin() {
        if (!selected || busy || checking || actionPending.current) return;
        setError(""); setActionNotice("");
        // Open the OS picker during the trusted click. This only selects a local File;
        // formatting and downloading still verify the current account with getUser.
        if (isAuthenticated) { inputRef.current?.click(); return; }
        const journal = selected, job = jobRef.current;
        actionPending.current = true;
        flushSync(() => setDialogVisible(false));
        try {
            if (!await requestLogin("选择论文原稿并进行排版", returnTo(journal)) || job !== jobRef.current) return;
            flushSync(() => setDialogVisible(true));
            setActionNotice("登录状态已确认，请再次点击“选择论文 Word 文件”打开本机文件选择器。");
        } catch (error) { setError(error instanceof Error ? error.message : "登录状态验证失败，请重试。"); setDialogVisible(true); }
        finally { actionPending.current = false; }
    }
    function selectFile(next: File | undefined) {
        if (!next) return;
        setResult(null); setError(""); setActionNotice("");
        if (!/\.docx$/i.test(next.name)) { setFile(null); setError("请上传 .docx 文件。旧版 .doc 请先在 Word 中另存为 .docx。"); return; }
        if (next.size > MAX_FILE_BYTES) { setFile(null); setError("文件超过 20 MB，请压缩内嵌图片后重试。"); return; }
        setFile(next);
    }
    function updateOptions(patch: Partial<ManuscriptOptions>) { setOptions(value => ({ ...value, ...patch })); setResult(null); setError(""); }
    async function format() {
        if (!selected || !file || busy || checking || actionPending.current) return;
        const journal = selected, manuscript = file, settings = { ...options };
        const job = ++jobRef.current;
        actionPending.current = true; setError("");
        // Keep the document and settings in local state while login takes focus.
        flushSync(() => setDialogVisible(false));
        try {
            if (!await requestLogin("进行论文排版", returnTo(journal)) || job !== jobRef.current) return;
            flushSync(() => setDialogVisible(true));
            setBusy(true); setResult(null);
            const { formatManuscript } = await import("@/lib/manuscript/format-docx");
            const output = await formatManuscript(await manuscript.arrayBuffer(), journal.id, settings);
            if (job === jobRef.current) setResult(output);
        } catch (cause) {
            if (job === jobRef.current) { setDialogVisible(true); setError(cause instanceof Error ? cause.message : "排版未完成，请重新上传文档后重试。"); }
        } finally { actionPending.current = false; if (job === jobRef.current) setBusy(false); }
    }
    async function downloadResult() {
        if (!selected || !downloadUrl || busy || checking || actionPending.current) return;
        const journal = selected, href = downloadUrl, filename = outputName, job = jobRef.current;
        actionPending.current = true;
        flushSync(() => setDialogVisible(false));
        try {
            if (!await requestLogin("下载排版后的论文", returnTo(journal)) || job !== jobRef.current) return;
            flushSync(() => setDialogVisible(true));
            const link = document.createElement("a");
            link.href = href; link.download = filename; document.body.append(link); link.click(); link.remove();
        } catch (error) { setError(error instanceof Error ? error.message : "登录状态验证失败，请重试。"); setDialogVisible(true); }
        finally { actionPending.current = false; }
    }
    const outputName = file && selected ? `${file.name.replace(/\.docx$/i, "")}-${selected.id}-formatted.docx` : "formatted-manuscript.docx";

    return <main className="resource-page manuscript-page">
        <header className="resource-hero">
            <div>
                <span className="resource-eyebrow"><BookOpen size={13} /> MANUSCRIPT STUDIO</span>
                <h1>论文排版</h1>
                <p>浏览期刊指南与排版参数，登录后选择 Word 原稿并生成可编辑的排版文件。</p>
            </div>
            <div className="manuscript-hero-mark" aria-hidden="true"><span><FileText size={26} /></span><div><strong>Manuscript Studio</strong><small>保留原稿 · 输出可编辑</small></div></div>
        </header>
        <div className="resource-stats">
            <div className="resource-stat" style={{ "--stat-wash": "#d8c8ff" } as CSSProperties}><span className="resource-stat-label">期刊排版方案</span><strong>{JOURNAL_PRESETS.length} 本期刊</strong><small>综合科研 · 材料与能源 · 生命科学</small></div>
            <div className="resource-stat" style={{ "--stat-wash": "#c8e1ff" } as CSSProperties}><span className="resource-stat-label">原稿处理方式</span><strong>本机处理</strong><small>文件留在你的设备，保留原始内容</small></div>
            <div className="resource-stat" style={{ "--stat-wash": "#ffd0de" } as CSSProperties}><span className="resource-stat-label">排版输出</span><strong>可编辑 DOCX</strong><small>下载新文件，继续在 Word 中复核</small></div>
        </div>
        <div className="manuscript-steps" aria-label="排版步骤"><span><b>01</b> 选择期刊</span><ArrowRight size={12} /><span><b>02</b> 上传原稿，确认参数</span><ArrowRight size={12} /><span><b>03</b> 下载并复核</span></div>
        <section className="resource-catalog" aria-label="期刊排版方案">
            <div className="manuscript-catalog-heading"><div><h2>选择目标期刊</h2><p>每份方案附官方指南与可调整的正文排版预设。</p></div><span className="resource-chip"><BookOpen size={12} /> {JOURNAL_PRESETS.length} 个方案</span></div>
            <div className="resource-toolbar">
                <label className="manuscript-search"><Search size={15} /><input aria-label="搜索期刊" placeholder="搜索期刊或出版社…" value={search} onChange={event => setSearch(event.target.value)} /></label>
                <select aria-label="期刊领域" value={field} onChange={event => setField(event.target.value)}>{["全部领域", "综合科研", "材料与能源", "生命科学"].map(item => <option key={item}>{item}</option>)}</select>
                <span className="resource-meta">显示 {filtered.length} 个方案</span>
            </div>
            {filtered.length ? <div className="resource-grid">{filtered.map(journal => <button className="resource-card manuscript-journal-card" type="button" key={journal.id} onClick={() => chooseJournal(journal)} aria-label={`选择 ${journal.name} 进行论文排版`}>
                <div className={`manuscript-journal-cover manuscript-journal-cover--${journal.accent}`} aria-hidden="true"><div className="manuscript-cover-book"><span>RESEARCH</span><strong>{journal.monogram}</strong><i /></div><div className="manuscript-cover-orbit" /><span className="resource-chip">{journal.field}</span></div>
                <div className="manuscript-journal-copy"><span className="manuscript-publisher">{journal.publisher}</span><h2>{journal.name}</h2><p>{journal.summary}</p></div>
                <div className="resource-card-footer"><span className="manuscript-policy-tag">{journal.policy}</span><span className="manuscript-card-cta">选择排版 <ArrowRight size={13} /></span></div>
            </button>)}</div> : <div className="resource-empty">未找到匹配期刊，试试其他名称或领域。</div>}
            <div className="manuscript-catalog-foot"><ShieldCheck size={13} /><span>官方指南核对于 2026.10.03 · 保留原稿，下载可编辑排版文件</span></div>
        </section>
        <p className="manuscript-scope-note">当前提供投稿稿件的版式整理。字体、字号、纸张和页边距可按需要调整；参考文献、章节顺序和图片内容保留，期刊的最终出版排版由出版社完成。</p>

        <ResourceDialog open={!!selected && dialogVisible} onClose={closeJournal} title={selected?.name ?? "论文排版"} eyebrow="JOURNAL FORMATTING" footer={<>
            <button className="resource-button" type="button" disabled={busy || checking} onClick={closeJournal}>返回期刊列表</button>
            {result && downloadUrl ? <button type="button" disabled={busy || checking} className="resource-button resource-button--primary" onClick={() => void downloadResult()}><Download size={15} /> 下载排版 Word</button> : <button className="resource-button resource-button--primary" type="button" disabled={!file || busy || checking} onClick={() => void format()}>{busy || checking ? <Loader2 size={15} className="manuscript-spinner" /> : <SlidersHorizontal size={15} />}{busy ? "正在本地排版…" : checking ? "验证登录状态…" : "生成排版 Word"}</button>}
        </>}>
            {selected && <div className="manuscript-editor">
                <section className="manuscript-panel manuscript-policy"><div className="manuscript-panel-heading"><h3><span>01</span> 期刊规范</h3><span className="resource-chip">{selected.policy}</span></div><p>{selected.summary}</p><ul className="resource-detail-list">{selected.officialRequirements.map(item => <li key={item}>{item}</li>)}</ul><div className="manuscript-source-links"><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> 官方作者指南</a>{selected.templateUrl && <a href={selected.templateUrl} target="_blank" rel="noopener noreferrer"><FileText size={13} /> 官方模板入口</a>}<span>核对日期 {selected.checkedOn}</span></div></section>
                <section className="manuscript-panel"><div className="manuscript-panel-heading"><h3><span>02</span> 上传论文原稿</h3><span className="manuscript-local-note"><ShieldCheck size={12} /> 本机处理</span></div>
                <input ref={inputRef} className="manuscript-file-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="上传论文 Word" disabled={busy || checking} tabIndex={-1} onChange={event => { selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                <button className={`manuscript-upload ${file ? "manuscript-upload--ready" : ""}`} type="button" disabled={busy || checking} onClick={() => void chooseFileAfterLogin()}>
                    {file ? <FileText size={26} /> : <UploadCloud size={28} />}<strong>{file ? file.name : "选择论文 Word 文件"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · 点击更换文件` : ".docx · 最大 20 MB · 不上传到服务器"}</span>
                </button><p className="manuscript-login-note">期刊指南与参数可自由浏览。登录返回后，请再次点击选择本机原稿；生成排版前会重新验证账号，文稿不上传到服务器。</p></section>
                <section className="manuscript-panel"><div className="manuscript-panel-heading"><h3><span>03</span> 排版设置</h3><span className="resource-meta">可调整的正文预设</span></div>
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
                <p className="manuscript-preservation">保留正文、图片、表格、公式、引文域和修订记录。表格、公式及图注的局部字号保持原样；输出为一份新文件，原稿不改写。</p></section>
                {error && <p className="manuscript-error" role="alert">{error}</p>}
                {actionNotice && <p className="manuscript-progress" role="status">{actionNotice}</p>}
                {busy && <p className="manuscript-progress" role="status">正在读取文档并应用排版，请保留此页面。</p>}
                {result && <section className="manuscript-panel manuscript-result" role="status">
                    <div className="manuscript-result-heading"><span><CheckCircle2 size={21} /></span><div><h3>排版完成，可以下载</h3><p>已生成新 Word 文件，原稿保持完整。</p></div></div>
                    <div className="manuscript-result-stats"><span><b>{result.report.paragraphCount}</b> 段落</span><span><b>{result.report.tableCount}</b> 表格</span><span><b>{result.report.imageCount}</b> 图片资源</span><span><b>{result.report.equationCount}</b> 公式</span></div>
                    <div className="manuscript-report-block"><h4>本次已应用</h4><ul className="resource-detail-list">{result.report.changes.map(item => <li key={item}>{item}</li>)}</ul></div>
                    {result.report.warnings.length > 0 && <div className="manuscript-report-block manuscript-report-block--attention"><h4>文档中的注意项</h4><ul className="resource-detail-list">{result.report.warnings.map(item => <li key={item}>{item}</li>)}</ul></div>}
                    <div className="manuscript-report-block"><h4>投稿前由你复核</h4><ul className="resource-detail-list">{result.report.checks.map(item => <li key={item}>{item}</li>)}</ul></div>
                </section>}
            </div>}
        </ResourceDialog>
        {LoginPrompt}
    </main>;
}
