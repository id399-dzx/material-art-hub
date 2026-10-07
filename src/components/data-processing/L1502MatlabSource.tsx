"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, Code2, Download, FileCode2, FolderOpen, Loader2, RotateCcw } from "lucide-react";
import { l1502MatlabMetadataPath, readL1502MatlabManifest, type L1502MatlabManifest } from "@/lib/data-processing/l1502-matlab";
import "./l1502-matlab-source.css";

type LoadState = { key: string; error: string; loading: boolean };

export default function L1502MatlabSource({ issue, active = true }: { issue: number; active?: boolean }) {
    const [loadedManifest, setManifest] = useState<L1502MatlabManifest | null>(null);
    const [selectedPath, setSelectedPath] = useState("");
    const [sources, setSources] = useState<Record<string, string>>({});
    const [load, setLoad] = useState<LoadState>({ key: "", error: "", loading: false });
    const [retry, setRetry] = useState(0);
    const [copying, setCopying] = useState(false);
    const [feedback, setFeedback] = useState({ path: "", copied: false, message: "" });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLPreElement>(null);
    const manifest = loadedManifest?.issue === issue ? loadedManifest : null;
    const script = manifest?.scripts.find(item => item.path === selectedPath) ?? manifest?.scripts[0];
    const path = script?.path ?? "";
    const code = sources[path];

    useEffect(() => {
        if (!active || loadedManifest?.issue === issue) return;
        const controller = new AbortController();
        async function loadManifest() {
            let key = "";
            try {
                key = l1502MatlabMetadataPath(issue);
                setLoad({ key, loading: true, error: "" });
                const response = await fetch(key, { signal: controller.signal });
                if (!response.ok) throw new Error("源码信息暂时未能加载，请重试。");
                const next = readL1502MatlabManifest(await response.json(), issue);
                if (!controller.signal.aborted) {
                    setManifest(next);
                    setLoad({ key, loading: false, error: "" });
                }
            } catch (cause) {
                if (!controller.signal.aborted) setLoad({ key, loading: false, error: cause instanceof Error ? cause.message : "源码信息暂时未能加载，请重试。" });
            }
        }
        void loadManifest();
        return () => controller.abort();
    }, [active, issue, loadedManifest?.issue, retry]);

    useEffect(() => {
        if (!active || !path || sources[path] !== undefined) return;
        const controller = new AbortController();
        async function loadSource() {
            try {
                setLoad({ key: path, loading: true, error: "" });
                const response = await fetch(path, { signal: controller.signal });
                if (!response.ok) throw new Error("这一份源码暂时未能加载，请重试。");
                const source = await response.text();
                if (!source.trim()) throw new Error("这一份源码内容为空，请重试。");
                if (!controller.signal.aborted) {
                    setSources(current => ({ ...current, [path]: source }));
                    setLoad({ key: path, loading: false, error: "" });
                }
            } catch (cause) {
                if (!controller.signal.aborted) setLoad({ key: path, loading: false, error: cause instanceof Error ? cause.message : "这一份源码暂时未能加载，请重试。" });
            }
        }
        void loadSource();
        return () => controller.abort();
    }, [active, path, sources, retry]);

    async function copySource() {
        if (!code || copying) return;
        setCopying(true);
        let copied = false;
        try {
            if (navigator.clipboard?.writeText) {
                try { await navigator.clipboard.writeText(code); copied = true; } catch { /* Fall back to the visible, selectable source. */ }
            }
            if (!copied && textareaRef.current) {
                textareaRef.current.focus({ preventScroll: true });
                textareaRef.current.select();
                copied = document.execCommand("copy");
            }
        } catch { copied = false; }
        finally {
            if (!copied && textareaRef.current) {
                textareaRef.current.focus({ preventScroll: true });
                textareaRef.current.select();
            }
            setFeedback({ path, copied, message: copied ? "已复制完整源码，可以粘贴到 MATLAB。" : "浏览器未允许自动复制，已选中全文。请按 ⌘C（Windows：Ctrl+C）复制。" });
            setCopying(false);
        }
    }

    const visibleError = load.error && (!manifest || load.key === path) ? load.error : "";
    const helpers = manifest?.scripts.filter(item => item.role === "helper" && item.path !== path) ?? [];

    return <section className="l1502-matlab" aria-label={`第 ${issue} 期 MATLAB 源码`}>
        <header className="l1502-matlab-intro">
            <span className="l1502-matlab-intro-icon"><Code2 size={23} /></span>
            <div><span className="l1502-matlab-eyebrow">MATLAB SOURCE</span><h3>从图例到代码</h3><p>查看这一期的原始 MATLAB 脚本，复制后在本地继续调整。</p></div>
            <span className="l1502-matlab-issue">来源第 {issue} 期{manifest && ` · ${manifest.scripts.length} 份脚本`}</span>
        </header>

        {manifest && manifest.scripts.length > 1 && <div className="l1502-matlab-files" aria-label="选择 MATLAB 文件">
            {manifest.scripts.map(item => <button key={item.path} type="button" aria-pressed={item.path === path} onClick={() => setSelectedPath(item.path)}>
                <FileCode2 size={15} /><span>{item.name}</span><small>{item.role === "helper" ? "辅助函数" : "绘图脚本"}</small>
            </button>)}
        </div>}

        <div className="l1502-matlab-code-window">
            <div className="l1502-matlab-code-toolbar">
                <div className="l1502-matlab-file-heading"><FileCode2 size={16} /><strong>{script?.name ?? "MATLAB 脚本"}</strong>{script && <span>{script.lines} 行 · UTF-8</span>}</div>
                <div className="l1502-matlab-actions">
                    {script && <a href={script.path} download={script.name} aria-label={`下载 ${script.name}`}><Download size={15} /><span>下载 .m</span></a>}
                    <button type="button" disabled={!code || copying} className="l1502-matlab-copy" onClick={copySource}>
                        {copying ? <Loader2 size={15} className="l1502-matlab-spin" /> : feedback.path === path && feedback.copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
                        {feedback.path === path && feedback.copied ? "再次复制" : "一键复制代码"}
                    </button>
                </div>
            </div>
            {visibleError ? <div className="l1502-matlab-placeholder" role="alert"><FileCode2 size={28} /><p>{visibleError}</p><button type="button" onClick={() => setRetry(value => value + 1)}><RotateCcw size={14} />重新加载</button></div> : code !== undefined && script ? <div className="l1502-matlab-code-body">
                <pre ref={gutterRef} aria-hidden="true" className="l1502-matlab-line-numbers">{code.split(/\r?\n/).map((_, index) => index + 1).join("\n")}</pre>
                <textarea ref={textareaRef} className="l1502-matlab-code" value={code} readOnly wrap="off" spellCheck={false}
                    aria-label={`${script.name} MATLAB 源码`} onScroll={event => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }} />
            </div> : <div className="l1502-matlab-placeholder" role="status"><Loader2 size={24} className="l1502-matlab-spin" /><p>正在加载这一期的源码…</p></div>}
            <div className="l1502-matlab-code-status" role="status" aria-live="polite">
                <span>{feedback.path === path && feedback.message ? feedback.message : "可直接选中文本复制；每次复制当前文件的完整内容。"}</span>
                <span>MATLAB · 本地运行</span>
            </div>
        </div>

        {script && <div className="l1502-matlab-notes">
            <article><span className="l1502-matlab-note-label"><FolderOpen size={15} />运行准备</span>
                {script.dataFiles.length > 0 && <p>数据文件：{script.dataFiles.map((name, index) => <span key={name}>{index > 0 && "、"}<code>{name}</code></span>)}。请按脚本要求自行准备数据，或将读取部分改为你的数据文件。</p>}
                {script.externalFunctions.length > 0 && <p>外部函数：{script.externalFunctions.map((name, index) => <span key={name}>{index > 0 && "、"}<code>{name}</code></span>)}。请自行安装相应 <code>.m</code> / <code>.p</code> 函数并加入 MATLAB 路径。</p>}
                {helpers.length > 0 && <p>同一期附带辅助函数：{helpers.map((helper, index) => <span key={helper.name}>{index > 0 && "、"}<code>{helper.name}</code></span>)}。可在上方切换查看，分别保存到脚本所在文件夹。</p>}
                {script.role === "helper" ? <p>此文件是辅助函数，请与本期主绘图脚本保存在同一文件夹，由主脚本调用；它不是可独立运行的绘图示例。</p> : script.dataFiles.length === 0 && script.externalFunctions.length === 0 && helpers.length === 0 && <p>此文件未引用额外数据或配色函数；运行前可直接修改脚本内的数据和参数。</p>}
                <small>此处提供 MATLAB 源码；网页编辑器不会执行它，也不会把上传数据自动写入原始脚本。</small>
            </article>
            <article><span className="l1502-matlab-note-label"><FileCode2 size={15} />源文件</span><p>{manifest?.folder}</p><small>保留原脚本内容与署名注释，统一为 UTF-8 编码。此处不附带原始测量数据或配色 P-code。</small></article>
        </div>}
    </section>;
}
