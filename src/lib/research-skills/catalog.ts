import curated from "./curation.json";
import snapshot from "./snapshot.json";

export const RESEARCH_SKILL_CATEGORIES = [
  { id: "literature", label: "文献与阅读" },
  { id: "figure", label: "科研绘图" },
  { id: "writing", label: "写作与排版" },
  { id: "presentation", label: "论文与汇报" },
  { id: "computing", label: "计算与仿真" },
  { id: "three-dimensional", label: "3D 可视化" },
  { id: "knowledge", label: "知识与文档" },
] as const;

export type ResearchSkillCategory = typeof RESEARCH_SKILL_CATEGORIES[number]["id"];
export type ResearchSkill = typeof curated[number] & typeof snapshot.repositories[number];

export const RESEARCH_SKILL_SOURCE = {
  account: snapshot.account,
  checkedAt: snapshot.checkedAt,
  synopsisReviewedAt: snapshot.synopsisReviewedAt,
  starredRepositoryCount: snapshot.starredRepositoryCount,
  url: snapshot.source,
};

export const RESEARCH_SKILLS: ResearchSkill[] = snapshot.repositories.flatMap((metadata) => {
  const synopsis = curated.find((entry) => entry.repo === metadata.repo);
  return synopsis ? [{ ...synopsis, ...metadata }] : [];
});

export function categoryLabel(category: string): string {
  return RESEARCH_SKILL_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

export function filterResearchSkills(search: string, category: string, scope: string): ResearchSkill[] {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return RESEARCH_SKILLS.filter((skill) => {
    if (category !== "all" && skill.category !== category) return false;
    if (scope !== "all" && skill.scope !== scope) return false;
    const text = [skill.title, skill.repo, skill.summary, categoryLabel(skill.category), ...skill.features, ...skill.topics, ...skill.skillPaths].join(" ").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
