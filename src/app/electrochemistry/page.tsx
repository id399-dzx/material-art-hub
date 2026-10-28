import type { Metadata } from "next";
import ElectrochemistryLibrary from "@/components/electrochemistry/ElectrochemistryLibrary";

export const metadata: Metadata = {
  title: "电化学知识 · Fesilent Reverie",
  description: "电化学基础概念、常用测试方法与数据判读，涵盖 CV、恒流充放电、EIS 与微分容量曲线，提供中文入门说明和参考来源。",
};

export default function ElectrochemistryPage() {
  return <ElectrochemistryLibrary />;
}
