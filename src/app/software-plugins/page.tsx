import type { Metadata } from "next";
import SoftwarePlugins from "@/components/software-plugins/SoftwarePlugins";

export const metadata: Metadata = {
  title: "软件插件 · 科研工作台",
  description: "下载用于 Blender、PowerPoint 与 Illustrator 的科研绘图和建模工具包，查看中文功能与安装说明。",
};

export default function SoftwarePluginsPage() {
  return <SoftwarePlugins />;
}
