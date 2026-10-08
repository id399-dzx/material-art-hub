import type { Metadata } from "next";
import ChartExamplesGallery from "@/components/chart-examples/ChartExamplesGallery";

export const metadata: Metadata = {
  title: "数据图示例 · Fesilent Reverie",
  description: "浏览完整 ECharts 图表示例，在线修改代码、实时预览并下载图表。",
};

export default function ChartExamplesPage() {
  return <ChartExamplesGallery />;
}
