"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Boxes, ChartNoAxesCombined, ChevronRight, FileText, FlaskConical, Github, Library, Presentation, Search, Sparkles } from "lucide-react";
import ResourceDialog from "@/components/resources/ResourceDialog";
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
const researchCount = RESEARCH_SKILLS.filter((skill) => skill.scope === "research").length;

export default function ResearchSkillsLibrary() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [scope, setScope] = useState("all");
  const [selected, setSelected] = useState<ResearchSkill | null>(null);
  const visible = useMemo(() => filterResearchSkills(search, category, scope), [search, category, scope]);

  return (
    <main className="resource-page research-skills-page">
      <section className="resource-hero research-skills-hero" aria-labelledby="research-skills-heading">
        <div>
          <span className="resource-eyebrow"><Sparkles size={15} /> RESEARCH SKILLS</span>
          <h1 id="research-skills-heading">让科研工具，<br />成为你的工作流。</h1>
          <p>从文献阅读到论文表达，整理值得收藏的开源技能。<br className="research-skills-desktop-break" /> 先看中文功能简介，再找到适合当下任务的项目。</p>
          <a className="research-skills-source" href={RESEARCH_SKILL_SOURCE.url} target="_blank" rel="noopener noreferrer">
            <Github size={15} /> 来自 {RESEARCH_SKILL_SOURCE.account} 的 GitHub 星标 <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="research-skills-overview" aria-label="技能目录概况">
          <div className="research-skills-overview__orbit" aria-hidden="true"><FlaskConical size={38} strokeWidth={1.4} /><span /><i /></div>
          <div className="research-skills-overview__stats">
            <div><strong>{RESEARCH_SKILLS.length}</strong><span>开源仓库</span></div>
            <div><strong>{researchCount}</strong><span>科研专用</span></div>
            <div><strong>{RESEARCH_SKILL_CATEGORIES.length}</strong><span>研究场景</span></div>
          </div>
          <span className="research-skills-overview__caption">中文介绍核对于 {reviewedDate}</span>
        </div>
      </section>

      <section aria-labelledby="research-skills-catalog-heading">
        <div className="research-skills-heading-row">
          <div><span className="resource-eyebrow">THE COLLECTION</span><h2 id="research-skills-catalog-heading">科研技能库</h2></div>
          <p>点击卡片了解功能 · 查看详情前往 GitHub</p>
        </div>
        <div className="resource-toolbar research-skills-toolbar">
          <label className="research-skills-search"><Search size={18} /><span className="research-skills-sr-only">搜索科研 Skill</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索文献、绘图、MATLAB、PPT…" /></label>
          <label className="research-skills-scope"><span>适用范围</span><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">全部 Skills</option><option value="research">科研专用</option><option value="support">科研辅助</option></select></label>
        </div>
        <div className="research-skills-categories" role="group" aria-label="按研究场景筛选">
          <button type="button" className="resource-chip" aria-pressed={category === "all"} onClick={() => setCategory("all")}>全部 <span>{RESEARCH_SKILLS.length}</span></button>
          {RESEARCH_SKILL_CATEGORIES.map((item) => <button type="button" key={item.id} className="resource-chip" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label} <span>{RESEARCH_SKILLS.filter((skill) => skill.category === item.id).length}</span></button>)}
        </div>
        <p className="resource-meta research-skills-results" role="status">当前展示 {visible.length} 个仓库 · 同一工具集的子技能集中展示</p>
        <div className="resource-grid">
          {visible.map((skill) => {
            const Icon = categoryIcons[skill.category as keyof typeof categoryIcons] ?? Sparkles;
            return (
              <article className={`resource-card research-skill-card research-skill-card--${skill.category}`} key={skill.repo}>
                <button type="button" className="research-skill-card__open" onClick={() => setSelected(skill)} aria-label={`了解 ${skill.title} 的功能`} aria-haspopup="dialog">
                  <span className="research-skill-card__top"><span className="resource-card-icon"><Icon size={23} strokeWidth={1.65} /></span><span className="research-skill-card__scope">{skill.scope === "research" ? "科研专用" : "科研辅助"}</span></span>
                  <span className="research-skill-card__title">{skill.title}</span>
                  <span className="research-skill-card__summary">{skill.summary}</span>
                  <span className="research-skill-card__category">{categoryLabel(skill.category)}{skill.skillPaths.length > 1 ? " · 技能集合" : " · 单项 Skill"}</span>
                  <span className="research-skill-card__intro">功能简介 <ChevronRight size={15} /></span>
                </button>
                <div className="resource-card-footer research-skill-card__footer"><span title={skill.repo}>{skill.owner}</span><a href={skill.url} target="_blank" rel="noopener noreferrer" aria-label={`查看 ${skill.title} 的 GitHub 详情`}>查看详情 <ArrowUpRight size={14} /></a></div>
              </article>
            );
          })}
        </div>
        {visible.length === 0 && <div className="resource-empty"><Search size={27} /><h3>没有找到匹配的技能</h3><p>试试“绘图”“文献”或仓库名称，也可以重置筛选。</p><button type="button" className="resource-button" onClick={() => { setSearch(""); setCategory("all"); setScope("all"); }}>重置筛选</button></div>}
        <div className="resource-detail-note research-skills-catalog-note"><BookOpen size={19} /><p>已核对 {RESEARCH_SKILL_SOURCE.starredRepositoryCount} 个公开星标仓库，收录其中含 Skill 定义的科研与科研辅助项目。技能集合在一个卡片内查看；普通软件和与科研无关的项目不作为科研 Skill 展示。</p></div>
      </section>

      <ResourceDialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.title ?? "科研 Skill 简介"} eyebrow={selected ? `${categoryLabel(selected.category)} · ${selected.scope === "research" ? "科研专用" : "科研辅助"}` : undefined} footer={selected && <><button type="button" className="resource-button" onClick={() => setSelected(null)}>返回技能库</button><a className="resource-button resource-button--primary" href={selected.url} target="_blank" rel="noopener noreferrer"><Github size={17} /> 查看详情 <ArrowUpRight size={15} /></a></>}>
        {selected && <div className="research-skill-detail">
          <p className="research-skill-detail__summary">{selected.summary}</p>
          <section><h3>能帮你做什么</h3><ul className="resource-detail-list">{selected.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></section>
          <div className="research-skill-detail__facts"><section><h3>你需要提供</h3><p>{selected.inputs}</p></section><section><h3>可以得到</h3><p>{selected.outputs}</p></section></div>
          <section><h3>使用环境</h3><p>{selected.environment}</p></section>
          <p className="resource-detail-note">{selected.note}</p>
          <details className="research-skill-detail__entries"><summary>查看仓库中的 Skill 入口 <span>{selected.skillPaths.length} 个定义文件</span></summary><ul>{selected.skillPaths.map((path) => <li key={path}><a href={`${selected.url}/blob/${selected.defaultBranch.split("/").map(encodeURIComponent).join("/")}/${path.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noopener noreferrer">{path} <ArrowUpRight size={12} /></a></li>)}</ul></details>
          <div className="resource-meta research-skill-detail__provenance"><span>来源：{selected.repo}</span><span>中文简介核对：{reviewedDate}</span><a href={selected.readmeUrl} target="_blank" rel="noopener noreferrer">原项目说明 <ArrowUpRight size={12} /></a></div>
        </div>}
      </ResourceDialog>
    </main>
  );
}
