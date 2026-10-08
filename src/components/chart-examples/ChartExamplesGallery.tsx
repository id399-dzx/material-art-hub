"use client";

/* The preview assets and example catalogue are Apache ECharts originals. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChartNoAxesCombined, Code2, ExternalLink, Layers3, Loader2, Maximize2, Minimize2, Moon, Search, Sun, X } from "lucide-react";
import { ECHARTS_EXAMPLES, ECHARTS_CATEGORIES, ECHARTS_UPSTREAM } from "@/lib/chart-examples/catalog";
import "./chart-examples.css";

type Example = (typeof ECHARTS_EXAMPLES)[number];

function exampleTheme(example: Example, dark: boolean) {
  return example.theme || (dark ? "dark" : "");
}

function previewSource(example: Example, dark: boolean) {
  const theme = exampleTheme(example, dark);
  return `/echarts-official/${example.isGL ? "data-gl" : "data"}/thumb${theme ? `-${theme}` : ""}/${example.id}.webp`;
}

function editorSource(example: Example, dark: boolean) {
  const query = new URLSearchParams({ c: example.id, version: ECHARTS_UPSTREAM.version });
  if (example.isGL) query.set("gl", "1");
  const theme = exampleTheme(example, dark);
  if (theme) query.set("theme", theme);
  return `/echarts-official/zh/editor.html?${query}`;
}

export default function ChartExamplesGallery() {
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ECHARTS_CATEGORIES[0].id);
  const [selected, setSelected] = useState<Example | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [closeConfirmation, setCloseConfirmation] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const confirmationReturnFocus = useRef<HTMLElement | null>(null);
  const closeConfirmationOpen = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollLockUntil = useRef(0);
  const editorDirty = useRef(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return ECHARTS_EXAMPLES;
    return ECHARTS_EXAMPLES.filter(example => [example.titleCN, example.title, example.id,
      ...example.category.map(id => ECHARTS_CATEGORIES.find(category => category.id === id)?.label ?? id),
    ].join(" ").toLocaleLowerCase().includes(query));
  }, [search]);

  const groups = useMemo(() => ECHARTS_CATEGORIES.map(category => ({
    ...category,
    examples: filtered.filter(example => example.category.includes(category.id)).sort((a, b) =>
      Number(a.isGL) - Number(b.isGL) || a.category.indexOf(category.id) - b.category.indexOf(category.id)),
  })).filter(category => category.examples.length), [filtered]);

  const finishClose = useCallback(() => {
    if (document.fullscreenElement === dialogRef.current) void document.exitFullscreen();
    editorDirty.current = false;
    closeConfirmationOpen.current = false;
    setCloseConfirmation(false);
    setSelected(null);
    setExpanded(false);
  }, []);

  const cancelClose = useCallback(() => {
    closeConfirmationOpen.current = false;
    setCloseConfirmation(false);
  }, []);

  const closeEditor = useCallback(() => {
    if (closeConfirmationOpen.current) { cancelClose(); return; }
    if (!editorDirty.current) { finishClose(); return; }
    confirmationReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeConfirmationOpen.current = true;
    setCloseConfirmation(true);
  }, [cancelClose, finishClose]);

  useEffect(() => {
    const confirmation = confirmationRef.current;
    if (!confirmation || !closeConfirmation) return;
    if (!confirmation.open) confirmation.showModal();
    continueEditingRef.current?.focus({ preventScroll: true });
    return () => {
      if (confirmation.open) confirmation.close();
      const previousFocus = confirmationReturnFocus.current;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [closeConfirmation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [selected]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "fesilent-echarts-editor-dirty" && typeof event.data.modified === "boolean") editorDirty.current = event.data.modified;
      else if (event.data?.type === "fesilent-echarts-editor-close") closeEditor();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [closeEditor]);

  useEffect(() => {
    const onFullscreenChange = () => setExpanded(document.fullscreenElement === dialogRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (!id.startsWith("chart-type-")) return;
      const categoryId = id.slice("chart-type-".length);
      if (!ECHARTS_CATEGORIES.some(category => category.id === categoryId)) return;
      setActiveCategory(categoryId);
      scrollLockUntil.current = performance.now() + 400;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    const frame = requestAnimationFrame(scrollToHash);
    window.addEventListener("hashchange", scrollToHash);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", scrollToHash); };
  }, []);

  useEffect(() => {
    let frame = 0;
    const syncCategory = () => {
      frame = 0;
      if (performance.now() < scrollLockUntil.current || !groups.length) return;
      let current = groups[0].id;
      for (const group of groups) {
        const element = document.getElementById(`chart-type-${group.id}`);
        if (element && element.getBoundingClientRect().top <= 110) current = group.id;
        else break;
      }
      setActiveCategory(current);
      const nextHash = `#chart-type-${current}`;
      if (window.location.hash !== nextHash && resultsRef.current && resultsRef.current.getBoundingClientRect().top < 140) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${nextHash}`);
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(syncCategory); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [groups]);

  useEffect(() => {
    const nav = sidebarRef.current;
    const link = nav?.querySelector<HTMLAnchorElement>(`[data-category="${activeCategory}"]`);
    if (!nav || !link) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (nav.scrollHeight > nav.clientHeight) {
      const top = linkRect.top - navRect.top + nav.scrollTop;
      if (top < nav.scrollTop) nav.scrollTop = top;
      else if (top + link.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = top + link.offsetHeight - nav.clientHeight;
    }
    if (nav.scrollWidth > nav.clientWidth) {
      if (linkRect.left < navRect.left) nav.scrollLeft += linkRect.left - navRect.left;
      else if (linkRect.right > navRect.right) nav.scrollLeft += linkRect.right - navRect.right;
    }
  }, [activeCategory]);

  const handleCategorySelect = useCallback((id: string) => {
    setActiveCategory(id);
    scrollLockUntil.current = performance.now() + 850;
    const hash = `#chart-type-${id}`;
    window.history.pushState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
    document.getElementById(`chart-type-${id}`)?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, []);

  const openEditor = (example: Example) => {
    editorDirty.current = false;
    closeConfirmationOpen.current = false;
    setCloseConfirmation(false);
    setEditorReady(false);
    setExpanded(false);
    setSelected(example);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === dialogRef.current) {
      await document.exitFullscreen();
      return;
    }
    if (expanded) { setExpanded(false); return; }
    try {
      if (dialogRef.current?.requestFullscreen) await dialogRef.current.requestFullscreen();
      else setExpanded(true);
    } catch { setExpanded(true); }
  };

  return <main className="chart-examples-page">
    <div className="chart-examples-shell">
      <header className="chart-examples-hero">
        <div>
          <span className="chart-examples-eyebrow"><ChartNoAxesCombined size={13} /> CHART EXAMPLES <i aria-hidden="true">/</i> 图表探索</span>
          <h1>数据图示例</h1>
          <p>从图形找到灵感，修改代码与数据，即时看到变化。</p>
        </div>
        <a className="chart-examples-link" href={ECHARTS_UPSTREAM.gallery} target="_blank" rel="noopener noreferrer">ECharts 官方示例 <ArrowUpRight size={14} /></a>
      </header>

      <div className="chart-examples-layout">
        <aside className="chart-examples-sidebar" aria-labelledby="chart-examples-categories-title">
          <div className="chart-examples-sidebar-heading"><span><Layers3 size={16} /><strong id="chart-examples-categories-title">图形分类</strong></span><small>{ECHARTS_CATEGORIES.length} 类</small></div>
          <nav className="chart-examples-categories" aria-label="图形分类" ref={sidebarRef}>
            {ECHARTS_CATEGORIES.map(category => {
              const count = filtered.filter(example => example.category.includes(category.id)).length;
              return <a key={category.id} href={`#chart-type-${category.id}`} data-category={category.id}
                className={`${activeCategory === category.id ? "is-active" : ""}${!count ? " is-empty" : ""}`}
                aria-current={activeCategory === category.id ? "location" : undefined}
                aria-disabled={!count || undefined}
                onClick={event => { event.preventDefault(); if (count) handleCategorySelect(category.id); }}>
                <span><img src={category.icon} alt="" aria-hidden="true" width={19} height={19} />{category.label}</span><small>{count}</small>
              </a>;
            })}
          </nav>
          <p className="chart-examples-sidebar-note">选择示例，在线编辑与导出。</p>
        </aside>

        <div ref={resultsRef} className="chart-examples-results">
          <section className="chart-examples-tools" aria-label="示例搜索与预览设置">
            <div className="chart-examples-tools-heading"><div><span className="chart-examples-eyebrow">EXPLORE THE COLLECTION</span><h2>示例一览</h2></div><span>{ECHARTS_EXAMPLES.length} 个示例 · 原始图形与交互</span></div>
            <div className="chart-examples-tools-row">
              <label className="chart-examples-search"><Search size={16} /><span className="chart-examples-visually-hidden">搜索图表名称、类型或关键词</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索图表名称、类型或关键词" />{search && <button type="button" aria-label="清空搜索" onClick={() => setSearch("")}><X size={14} /></button>}</label>
              <button type="button" className={`chart-examples-theme${dark ? " is-dark" : ""}`} role="switch" aria-checked={dark} onClick={() => setDark(value => !value)}>
                {dark ? <Moon size={15} /> : <Sun size={15} />}深色预览<span className="chart-examples-switch" aria-hidden="true"><i /></span>
              </button>
            </div>
            <div className="chart-examples-results-meta" role="status"><span>{search.trim() ? <>找到 <strong>{filtered.length}</strong> 个示例</> : <>浏览 <strong>{ECHARTS_CATEGORIES.length}</strong> 类图形</>}</span><span>点击图表打开在线编辑器</span></div>
          </section>

          {groups.map(group => <section key={group.id} className="chart-examples-group" aria-labelledby={`chart-type-${group.id}`}>
            <header className="chart-examples-group-heading" id={`chart-type-${group.id}`}><img src={group.icon} alt="" width={21} height={21} /><h2>{group.label}</h2><span>{group.id}</span><small>{group.examples.length} 个示例</small></header>
            <div className="chart-examples-grid" id={`chart-row-${group.id}`}>
              {group.examples.map(example => <button key={example.id} type="button" className="chart-examples-card" onClick={() => openEditor(example)} aria-label={`打开 ${example.titleCN || example.title} 在线编辑`}>
                <div className="chart-examples-preview"><img src={previewSource(example, dark)} alt={example.titleCN || example.title} width={600} height={450} loading="lazy" decoding="async" /></div>
                <div className="chart-examples-card-body"><div className="chart-examples-card-title"><h3>{example.titleCN || example.title}</h3>{example.since && <span className="chart-examples-version">v{example.since}+</span>}</div><p>{example.title}</p><div className="chart-examples-card-footer"><span>{example.isGL ? "3D / WebGL" : "ECharts"}</span><span><Code2 size={12} /> 编辑示例 <ArrowUpRight size={12} /></span></div></div>
              </button>)}
            </div>
          </section>)}
          {!filtered.length && <div className="chart-examples-empty"><Search size={26} /><h2>没有找到相关示例</h2><p>试试其他关键词，或清空搜索查看全部图形。</p><button type="button" onClick={() => setSearch("")}>查看全部示例</button></div>}
          <footer className="chart-examples-attribution"><span>图形、示例代码与预览来自 Apache ECharts，遵循 Apache 2.0 许可。</span><a href={ECHARTS_UPSTREAM.repository} target="_blank" rel="noopener noreferrer">查看源项目 <ExternalLink size={12} /></a></footer>
        </div>
      </div>
    </div>

    <dialog ref={dialogRef} className={`chart-examples-dialog${expanded ? " is-expanded" : ""}`} aria-labelledby="chart-examples-editor-title" onCancel={event => { event.preventDefault(); closeEditor(); }}>
      {selected && <>
        <header className="chart-examples-dialog-heading"><div><span className="chart-examples-eyebrow">数据图示例 <i aria-hidden="true">/</i> 在线编辑</span><h2 id="chart-examples-editor-title">{selected.titleCN || selected.title}</h2></div><div className="chart-examples-dialog-actions"><a href={editorSource(selected, dark)} target="_blank" rel="noopener noreferrer" className="chart-examples-icon-button" aria-label="在新窗口编辑" title="在新窗口编辑"><ExternalLink size={17} /></a><button type="button" className="chart-examples-icon-button" onClick={() => { void toggleFullscreen(); }} aria-label={expanded ? "退出全屏" : "全屏编辑"} title={expanded ? "退出全屏" : "全屏编辑"}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button><button type="button" className="chart-examples-icon-button" onClick={closeEditor} aria-label="关闭编辑器，返回图库" title="关闭编辑器"><X size={20} /></button></div></header>
        <div className="chart-examples-editor-frame">{!editorReady && <div className="chart-examples-editor-loading" role="status"><Loader2 size={22} /><span>正在打开示例…</span></div>}<iframe ref={iframeRef} src={editorSource(selected, dark)} title={`${selected.titleCN || selected.title} 在线编辑器`} onLoad={() => setEditorReady(true)} sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-pointer-lock" allow="fullscreen; clipboard-write" allowFullScreen /></div>
        <footer className="chart-examples-dialog-footer"><span>修改代码，即时预览；完成后可下载保存。</span><button type="button" onClick={closeEditor}><ArrowLeft size={14} />返回图库</button></footer>
        <dialog ref={confirmationRef} className="chart-examples-close-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="chart-examples-close-title" aria-describedby="chart-examples-close-description"
          onCancel={event => { event.preventDefault(); event.stopPropagation(); cancelClose(); }}>
          <span className="chart-examples-eyebrow">数据图示例 <i aria-hidden="true">/</i> 退出编辑</span>
          <h2 id="chart-examples-close-title">返回图库？</h2>
          <p id="chart-examples-close-description">本次代码已修改，关闭后将丢失本次修改。</p>
          <div className="chart-examples-close-actions"><button ref={continueEditingRef} type="button" onClick={cancelClose}>继续编辑</button><button type="button" onClick={finishClose}>放弃修改并返回</button></div>
        </dialog>
      </>}
    </dialog>
  </main>;
}
