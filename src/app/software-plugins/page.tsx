import type { Metadata } from "next";
import SoftwarePlugins from "@/components/software-plugins/SoftwarePlugins";

export const metadata: Metadata = {
  title: "软件插件 · Fesilent Reverie",
  description: "Fesilent Reverie 自研软件插件，查看中文功能介绍、适用环境与安装说明，下载管理员发布的安装包。",
};

export default function SoftwarePluginsPage() {
  return <SoftwarePlugins />;
}
