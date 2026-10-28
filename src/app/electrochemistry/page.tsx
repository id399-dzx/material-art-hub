import type { Metadata } from "next";
import ElectrochemistryLibrary from "@/components/electrochemistry/ElectrochemistryLibrary";

export const metadata: Metadata = {
  title: "电化学知识 · Fesilent Reverie",
  description: "通过法拉第嵌锂与非法拉第双电层充电动画理解电极过程，学习电化学基础、CV、恒流充放电与 EIS，提供中文讲解、MP4 下载和参考来源。",
};

export default function ElectrochemistryPage() {
  return <ElectrochemistryLibrary />;
}
