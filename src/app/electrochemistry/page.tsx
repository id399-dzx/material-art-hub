import type { Metadata } from "next";
import ElectrochemistryLibrary from "@/components/electrochemistry/ElectrochemistryLibrary";

export const metadata: Metadata = {
  title: "电化学知识 · Fesilent Reverie",
  description: "在同一知识专题中对照观看法拉第与非法拉第过程动画，通过机制对比与中文讲解理解电极界面；另提供 CV、恒流充放电、EIS 等知识，免费开放阅读。",
};

export default function ElectrochemistryPage() {
  return <ElectrochemistryLibrary />;
}
