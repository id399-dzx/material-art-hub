"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code2, Copy, Download, LoaderCircle, Play, RotateCcw, X } from "lucide-react";
import type { EChartsOption } from "echarts";
import { chartCodeFilename, createChartCodeSource, MAX_CHART_CODE_LENGTH } from "@/lib/data-processing/chart-code-export";
import "./chart-code-playground.css";

export type ChartCodePlaygroundProps = {
    open: boolean;
    onClose: () => void;
    option: EChartsOption | null;
    width: number;
    height: number;
    title: string;
    sourceLabel?: string;
};

const CHANNEL = "fesilent-chart-code-v1";
type RunState = "loading" | "running" | "success" | "error";
type CodeDraft = { code: string; svg: string; successfulAt: string; optionJson?: string };
type DraftCacheProps = {
    getDraft: (sourceKey: string) => CodeDraft | undefined;
    saveDraft: (sourceKey: string, draft: CodeDraft) => void;
};

function saveFile(content: string, filename: string, mime: string) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CodeSession({ onClose, option, width, height, title, sourceLabel, getDraft, saveDraft }: Omit<ChartCodePlaygroundProps, "open"> & DraftCacheProps) {
    const id = useId();
    const [starter] = useState(() => {
        try {
            if (!option) throw new Error("请先生成有效图表，再进入代码工作台。");
            return { ...createChartCodeSource(option), error: "" };
        } catch (error) {
            return { code: "", warnings: [], error: error instanceof Error ? error.message : "无法生成图表代码。" };
        }
    });
    const sourceKey = `${width}x${height}:${starter.code}`;
    const [restored] = useState(() => getDraft(sourceKey));
    const [token] = useState(() => crypto.randomUUID());
    const [code, setCode] = useState(restored?.code ?? starter.code);
    const [ready, setReady] = useState(false);
    const [automatic, setAutomatic] = useState(true);
    const [state, setState] = useState<RunState>(starter.error ? "error" : "loading");
    const [error, setError] = useState(starter.error);
    const [svg, setSvg] = useState(restored?.svg ?? "");
    const [optionJson, setOptionJson] = useState(restored?.optionJson ?? "");
    const [notice, setNotice] = useState("");
    const [successfulAt, setSuccessfulAt] = useState(restored?.successfulAt ?? "");
    const frame = useRef<HTMLIFrameElement>(null);
    const dialog = useRef<HTMLDivElement>(null);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const numbering = useRef<HTMLPreElement>(null);
    const lastRun = useRef(0);
    const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        saveDraft(sourceKey, { code, svg, successfulAt, optionJson });
    }, [saveDraft, sourceKey, code, svg, successfulAt, optionJson]);

    const run = useCallback((source: string) => {
        if (!ready || !frame.current?.contentWindow) return;
        if (!source.trim()) { setState("error"); setError("请填写图表代码。"); return; }
        if (source.length > MAX_CHART_CODE_LENGTH) { setState("error"); setError("代码超过 2 MB，请减少数据量。"); return; }
        const runId = ++lastRun.current;
        setState("running");
        setError("");
        if (watchdog.current) clearTimeout(watchdog.current);
        // A missed iframe response should never leave the Run button disabled forever.
        watchdog.current = setTimeout(() => {
            if (lastRun.current !== runId) return;
            setState("error");
            setError("预览未及时响应，请检查配置或重新打开代码工作台。");
        }, 8000);
        frame.current.contentWindow.postMessage({ channel: CHANNEL, token, kind: "run", id: runId, code: source, width, height }, "*");
    }, [ready, token, width, height]);

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            const message = event.data;
            if (event.source !== frame.current?.contentWindow || !message || message.channel !== CHANNEL || message.token !== token) return;
            if (message.kind === "ready") {
                if (restored?.optionJson) frame.current?.contentWindow?.postMessage({ channel: CHANNEL, token, kind: "restore", id: 0, json: restored.optionJson, width, height }, "*");
                setReady(true);
                return;
            }
            if (message.kind === "fatal") { setState("error"); setError(String(message.error || "图表引擎加载失败。")); return; }
            if (message.id !== lastRun.current) return;
            if (watchdog.current) clearTimeout(watchdog.current);
            if (message.kind === "error") {
                setState("error");
                setError(String(message.error || "代码运行失败。").slice(0, 1000));
            } else if (message.kind === "rendered" && typeof message.svg === "string" && message.svg.length < 20_000_000 && message.svg.includes("<svg")) {
                setSvg(message.svg);
                if (typeof message.json === "string" && message.json.length <= 4_000_000) setOptionJson(message.json);
                setState("success");
                setError("");
                setSuccessfulAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
            }
        };
        window.addEventListener("message", receive);
        return () => {
            window.removeEventListener("message", receive);
            if (watchdog.current) clearTimeout(watchdog.current);
        };
    }, [token, restored, width, height]);

    useEffect(() => {
        if (!ready || !automatic || starter.error) return;
        const debounce = setTimeout(() => run(code), 600);
        return () => clearTimeout(debounce);
    }, [code, ready, automatic, run, starter.error]);

    useEffect(() => {
        if (ready || starter.error) return;
        const timeout = setTimeout(() => {
            setState("error");
            setError("图表引擎加载超时，请检查连接并重新打开工作台。");
        }, 10000);
        return () => clearTimeout(timeout);
    }, [ready, starter.error]);

    useEffect(() => {
        const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.current?.focus();
        const keydown = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
            if (event.key !== "Tab" || !dialog.current) return;
            const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], iframe')];
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener("keydown", keydown, true);
        return () => {
            document.body.style.overflow = overflow;
            document.removeEventListener("keydown", keydown, true);
            before?.focus();
        };
    }, [onClose]);

    useEffect(() => {
        if (!notice) return;
        const dismiss = setTimeout(() => setNotice(""), 2500);
        return () => clearTimeout(dismiss);
    }, [notice]);

    const copyCode = async () => {
        try { await navigator.clipboard.writeText(code); setNotice("代码已复制"); }
        catch { textarea.current?.focus(); textarea.current?.select(); setNotice("请按 Ctrl/Cmd + C 复制所选代码"); }
    };
    const status = state === "loading" ? "正在加载图表引擎" : state === "running" ? "正在运行" : state === "error" ? "请修正代码" : "预览已更新";
    const lines = code.split("\n").length;

    return createPortal(<div className="chart-code-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="chart-code-dialog">
            <header className="chart-code-header">
                <div className="chart-code-header__icon"><Code2 size={21} aria-hidden="true" /></div>
                <div><span className="chart-code-eyebrow">CODE WORKSPACE</span><h2 id={`${id}-title`}>代码绘图工作台</h2><p>{sourceLabel ? `${sourceLabel} · ` : ""}{title || "当前数据图"}</p></div>
                <button type="button" className="chart-code-close" aria-label="关闭代码工作台" onClick={onClose}><X size={20} /></button>
            </header>
            <p className="chart-code-intro">编辑当前图表的独立代码副本，修改数据与样式，即时查看结果并下载。</p>
            <div className="chart-code-toolbar">
                <label className="chart-code-auto"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />自动运行<span>输入后 0.6 秒更新</span></label>
                <div className="chart-code-actions">
                    <button type="button" onClick={() => { setCode(starter.code); if (ready) run(starter.code); }} disabled={!starter.code}><RotateCcw size={14} />恢复初始代码</button>
                    <button type="button" className="chart-code-run" disabled={!ready || !!starter.error} onClick={() => run(code)}>{state === "running" ? <LoaderCircle size={14} className="chart-code-spin" /> : <Play size={14} />}运行代码</button>
                </div>
            </div>
            <div className="chart-code-panes">
                <section className="chart-code-source" aria-labelledby={`${id}-source`}>
                    <div className="chart-code-pane-title"><h3 id={`${id}-source`}>JavaScript · ECharts option</h3><span>{lines} 行</span></div>
                    <div className="chart-code-input">
                        <pre ref={numbering} aria-hidden="true">{Array.from({ length: Math.min(lines, 30000) }, (_, index) => index + 1).join("\n")}</pre>
                        <textarea ref={textarea} value={code} aria-label="图表 JavaScript 代码" spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" maxLength={MAX_CHART_CODE_LENGTH} onChange={event => setCode(event.target.value)} onScroll={event => { if (numbering.current) numbering.current.scrollTop = event.currentTarget.scrollTop; }} onKeyDown={event => {
                            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); run(code); }
                            if (event.key === "Tab" && !event.shiftKey) {
                                event.preventDefault();
                                const start = event.currentTarget.selectionStart, end = event.currentTarget.selectionEnd;
                                setCode(code.slice(0, start) + "  " + code.slice(end));
                                requestAnimationFrame(() => textarea.current?.setSelectionRange(start + 2, start + 2));
                            }
                        }} />
                    </div>
                    <div className="chart-code-source-help"><span>支持计算、数组 map 与数据替换；最终配置命名为 option。</span><kbd>⌘ / Ctrl + Enter</kbd></div>
                </section>
                <section className="chart-code-preview" aria-labelledby={`${id}-preview`}>
                    <div className="chart-code-pane-title"><h3 id={`${id}-preview`}>实时预览</h3><span className={`chart-code-state chart-code-state--${state}`}>{state === "success" ? <Check size={12} /> : (state === "loading" || state === "running") ? <LoaderCircle size={12} className="chart-code-spin" /> : null}{status}</span></div>
                    <div className="chart-code-preview-stage">
                        <iframe ref={frame} src={`/chart-code-sandbox.html#${token}`} title="代码图表实时预览" sandbox="allow-scripts" referrerPolicy="no-referrer" />
                        {!svg && (state === "loading" || state === "running") && <div className="chart-code-preview-loading"><LoaderCircle size={24} className="chart-code-spin" /><span>正在生成预览</span></div>}
                    </div>
                    <div className="chart-code-preview-meta"><span>{width} × {height} · SVG</span><span>{successfulAt ? `最近成功：${successfulAt}` : "等待有效代码"}</span></div>
                </section>
            </div>
            {error && <div className="chart-code-error" role="alert"><strong>代码运行提示</strong><span>{error}</span>{svg && <small>预览保留上一次成功结果；修正代码后重新运行。</small>}</div>}
            {starter.warnings.length > 0 && <details className="chart-code-warnings"><summary>原图文字显示说明（{starter.warnings.length} 项）</summary><ul>{starter.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
            <footer className="chart-code-footer">
                <span className="chart-code-footnote" role="status">{notice || "关闭重开保留改动，刷新前请下载保存。支持字符串 formatter；函数回调与外部网络请求暂不支持。"}</span>
                <div className="chart-code-actions"><button type="button" disabled={!code} onClick={copyCode}><Copy size={14} />复制代码</button><button type="button" disabled={!code} onClick={() => saveFile(code, chartCodeFilename(title, "js"), "text/javascript;charset=utf-8")}><Download size={14} />下载代码</button><button type="button" className="chart-code-export" disabled={!svg} onClick={() => saveFile(svg, chartCodeFilename(title, "svg"), "image/svg+xml;charset=utf-8")}><Download size={14} />下载 SVG</button></div>
            </footer>
        </div>
    </div>, document.body);
}

export default function ChartCodePlayground(props: ChartCodePlaygroundProps) {
    const cache = useRef(new Map<string, CodeDraft>());
    const getDraft = useCallback((sourceKey: string) => cache.current.get(sourceKey), []);
    const saveDraft = useCallback((sourceKey: string, draft: CodeDraft) => {
        cache.current.delete(sourceKey);
        cache.current.set(sourceKey, draft);
        // Keep recent experiments without retaining an unbounded set of source tables and SVGs.
        while (cache.current.size > 8) cache.current.delete(cache.current.keys().next().value!);
    }, []);
    return props.open ? <CodeSession {...props} getDraft={getDraft} saveDraft={saveDraft} /> : null;
}
