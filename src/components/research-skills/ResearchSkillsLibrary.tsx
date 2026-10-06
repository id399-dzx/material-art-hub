"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Boxes, ChartNoAxesCombined, ChevronRight, FileText, FlaskConical, Github, Library, Presentation, Search, Sparkles } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
import { useActionLogin } from "@/components/auth/useActionLogin";
import { useContentAdmin, useContentCatalog } from "@/components/admin/ContentProvider";
import { supabase } from "@/lib/supabase";
import { categoryLabel, filterResearchSkills, RESEARCH_SKILL_CATEGORIES, RESEARCH_SKILL_SOURCE, RESEARCH_SKILLS, type ResearchSkill } from "@/lib/research-skills/catalog";
import "./research-skills.css";

const categoryIcons = {
  literature: BookOpen,
  figure: ChartNoAxesCombined,
  writing: FileText,
  presentation: Presentation,
  computing: FlaskConical,
  "three-dimensional": Boxes,
  knowledge: Library,
};

const reviewedDate = RESEARCH_SKILL_SOURCE.synopsisReviewedAt.replaceAll("-", ".");
const skillKey = (skill: ResearchSkill) => skill.repo;

export default function ResearchSkillsLibrary() {
  const { items: skills, loading: catalogLoading, error: catalogError } = useContentCatalog("skills", RESEARCH_SKILLS, skillKey);
  const { isAdmin } = useContentAdmin();
  const researchCount = skills.filter((skill) => skill.scope === "research").length;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [scope, setScope] = useState("all");
  const [selected, setSelected] = useState<ResearchSkill | null>(null);
  const [actionError, setActionError] = useState("");
  const actionPending = useRef(false);
  const selectionRevision = useRef(0);
  const { checking, isAuthenticated, requestLogin, LoginPrompt } = useActionLogin();
  const visible = useMemo(() => filterResearchSkills(search, category, scope, skills), [search, category, scope, skills]);

  useEffect(() => {
    if (catalogLoading) return;
    const repo = new URLSearchParams(window.location.search).get("skill");
    const skill = skills.find(item => item.repo === repo);
    if (!skill) return;
    let cancelled = false;
    const revision = selectionRevision.current;
    // Restore an authenticated return from login; an anonymous query never opens details.
    void supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!cancelled && revision === selectionRevision.current && user && !error) setSelected(skill);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [catalogLoading, skills]);

  function returnTo(skill: ResearchSkill) { return "/research-skills?skill=" + encodeURIComponent(skill.repo); }
  function closeDetails() {
    selectionRevision.current++;
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("skill");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  async function openDetails(skill: ResearchSkill) {
    if (checking || actionPending.current) return;
    selectionRevision.current++;
    actionPending.current = true; setActionError("");
    try { if (await requestLogin("查看科研 Skill 详情", returnTo(skill))) setSelected(skill); }
    catch (error) { setActionError(error instanceof Error ? error.message : "登录状态验证失败，请重试。"); }
    finally { actionPending.current = false; }
  }
  async function openRepository(skill: ResearchSkill, url: string) {
    if (checking || actionPending.current) return;
    selectionRevision.current++;
    actionPending.current = true; setActionError("");
    // Close the detail dialog before a possible login dialog takes focus.
    flushSync(() => setSelected(null));
    try { if (await requestLogin("查看科研 Skill 项目详情", returnTo(skill))) window.location.assign(url); }
    catch (error) { setActionError(error instanceof Error ? error.message : "登录状态验证失败，请重试。"); }
    finally { actionPending.current = false; }
  }

  return (
    <main className="resource-page research-skills-page">
      <section className="resource-hero research-skills-hero" aria-labelledby="research-skills-heading">
        <div>
          <span className="resource-eyebrow"><Sparkles size={15} /> RESEARCH SKILLS</span>
          <h1 id="research-skills-heading">科研 Skill</h1>
          <p>文献、绘图、写作与科学计算的开源技能。目录与简介可浏览，登录后查看详细功能和项目说明。</p>
        </div>
        <a className="resource-button research-skills-source" href={RESEARCH_SKILL_SOURCE.url} target="_blank" rel="noopener noreferrer">
          <Github size={16} /> GitHub 星标 <ArrowUpRight size={14} />
        </a>
      </section>

      {isAdmin && <Link className="resource-button" href="/admin?section=skills">管理本板块</Link>}
      {catalogError && <p className="research-skills-action-error" role="alert">{catalogError}</p>}

      <section className="resource-stats" aria-label="技能目录概况">
        <div className="resource-stat" style={{ "--stat-wash": "#d9ccff" } as CSSProperties}><label>开源仓库</label><strong>{skills.length}</strong><small>已核对 {RESEARCH_SKILL_SOURCE.starredRepositoryCount} 个公开星标</small></div>
        <div className="resource-stat" style={{ "--stat-wash": "#c8e1ff" } as CSSProperties}><label>科研专用</label><strong>{researchCount}</strong><small>另有 {skills.length - researchCount} 个科研辅助项目</small></div>
        <div className="resource-stat" style={{ "--stat-wash": "#f6d3e5" } as CSSProperties}><label>研究场景</label><strong>{RESEARCH_SKILL_CATEGORIES.length}</strong><small>中文介绍核对于 {reviewedDate}</small></div>
      </section>

      <section className="resource-catalog" aria-labelledby="research-skills-catalog-heading">
        <div className="resource-catalog__header research-skills-heading-row">
          <h2 id="research-skills-catalog-heading">科研技能库</h2>
          <p>浏览卡片简介 · 登录后查看功能详情与 GitHub 项目</p>
        </div>
        <div className="resource-toolbar research-skills-toolbar">
          <label className="research-skills-search"><Search size={18} /><span className="research-skills-sr-only">搜索科研 Skill</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索文献、绘图、MATLAB、PPT…" /></label>
          <label className="research-skills-scope"><span>适用范围</span><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">全部 Skills</option><option value="research">科研专用</option><option value="support">科研辅助</option></select></label>
        </div>
        <div className="research-skills-categories" role="group" aria-label="按研究场景筛选">
          <button type="button" className="resource-chip" aria-pressed={category === "all"} onClick={() => setCategory("all")}>全部 <span>{skills.length}</span></button>
          {RESEARCH_SKILL_CATEGORIES.map((item) => <button type="button" key={item.id} className="resource-chip" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label} <span>{skills.filter((skill) => skill.category === item.id).length}</span></button>)}
        </div>
        <p className="resource-meta research-skills-results" role="status">当前展示 {visible.length} 个仓库 · 同一工具集的子技能集中展示{checking ? " · 正在验证登录状态…" : ""}</p>
        {actionError && <p className="research-skills-action-error" role="alert">{actionError}</p>}
        <div className="resource-grid">
          {visible.map((skill) => {
            const Icon = categoryIcons[skill.category as keyof typeof categoryIcons] ?? Sparkles;
            return (
              <article className={`resource-card research-skill-card research-skill-card--${skill.category}`} key={skill.repo}>
                <button type="button" className="research-skill-card__open" disabled={checking} onClick={() => void openDetails(skill)} aria-label={`查看 ${skill.title} 的功能详情，需登录`} aria-haspopup="dialog">
                  <span className="research-skill-card__top"><span className="resource-card-icon"><Icon size={23} strokeWidth={1.8} /></span><span className="research-skill-card__scope">{skill.scope === "research" ? "科研专用" : "科研辅助"}</span></span>
                  <span className="research-skill-card__title">{skill.title}</span>
                  <span className="research-skill-card__summary">{skill.summary}</span>
                  <span className="research-skill-card__meta"><span className="research-skill-card__category">{categoryLabel(skill.category)}{skill.skillPaths.length > 1 ? " · 技能集合" : " · 单项 Skill"}</span><span className="research-skill-card__intro">功能简介 <ChevronRight size={15} /></span></span>
                </button>
                <div className="resource-card-footer research-skill-card__footer"><span title={skill.repo}>{skill.owner}</span><button type="button" disabled={checking} onClick={() => void openRepository(skill, skill.url)} aria-label={`查看 ${skill.title} 的 GitHub 详情，需登录`}>查看详情 <ArrowUpRight size={14} /></button></div>
              </article>
            );
          })}
        </div>
        {catalogLoading && skills.length === 0 && <p className="resource-meta" role="status">正在读取科研 Skill 目录…</p>}
        {!catalogLoading && !catalogError && visible.length === 0 && <div className="resource-empty"><Search size={27} /><h3>没有找到匹配的技能</h3><p>试试“绘图”“文献”或仓库名称，也可以重置筛选。</p><button type="button" className="resource-button" onClick={() => { setSearch(""); setCategory("all"); setScope("all"); }}>重置筛选</button></div>}
        <div className="resource-detail-note research-skills-catalog-note"><BookOpen size={19} /><p>已核对 {RESEARCH_SKILL_SOURCE.starredRepositoryCount} 个公开星标仓库，收录其中含 Skill 定义的科研与科研辅助项目。技能集合在一个卡片内查看；普通软件和与科研无关的项目不作为科研 Skill 展示。</p></div>
      </section>

      <ResourceDialog open={selected !== null && isAuthenticated} onClose={closeDetails} title={selected?.title ?? "科研 Skill 简介"} eyebrow={selected ? `${categoryLabel(selected.category)} · ${selected.scope === "research" ? "科研专用" : "科研辅助"}` : undefined} footer={selected && <><button type="button" className="resource-button" onClick={closeDetails}>返回技能库</button><button type="button" disabled={checking} className="resource-button resource-button--primary" onClick={() => void openRepository(selected, selected.url)}><Github size={17} /> 查看详情 <ArrowUpRight size={15} /></button></>}>
        {selected && isAuthenticated && <div className="research-skill-detail">
          <p className="research-skill-detail__summary">{selected.summary}</p>
          <section><h3>能帮你做什么</h3><ul className="resource-detail-list">{selected.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></section>
          <div className="research-skill-detail__facts"><section><h3>你需要提供</h3><p>{selected.inputs}</p></section><section><h3>可以得到</h3><p>{selected.outputs}</p></section></div>
          <section><h3>使用环境</h3><p>{selected.environment}</p></section>
          <p className="resource-detail-note">{selected.note}</p>
          <details className="research-skill-detail__entries"><summary>查看仓库中的 Skill 入口 <span>{selected.skillPaths.length} 个定义文件</span></summary><ul>{selected.skillPaths.map((path) => <li key={path}><button type="button" disabled={checking} onClick={() => void openRepository(selected, selected.url + "/blob/" + selected.defaultBranch.split("/").map(encodeURIComponent).join("/") + "/" + path.split("/").map(encodeURIComponent).join("/"))}>{path} <ArrowUpRight size={12} /></button></li>)}</ul></details>
          <div className="resource-meta research-skill-detail__provenance"><span>来源：{selected.repo}</span><span>中文简介核对：{reviewedDate}</span><button type="button" disabled={checking} onClick={() => void openRepository(selected, selected.readmeUrl)}>原项目说明 <ArrowUpRight size={12} /></button></div>
        </div>}
      </ResourceDialog>
      {LoginPrompt}
    </main>
  );
}
