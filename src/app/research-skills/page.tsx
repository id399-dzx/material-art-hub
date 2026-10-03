import type { Metadata } from "next";
import ResearchSkillsLibrary from "@/components/research-skills/ResearchSkillsLibrary";

export const metadata: Metadata = {
  title: "科研 Skill · MaterialArt Hub",
  description: "从公开 GitHub 星标中整理科研与科研辅助 Skills，按文献、绘图、写作、汇报、计算和 3D 分类，提供中文功能简介。",
};

export default function ResearchSkillsPage() {
  return <ResearchSkillsLibrary />;
}
