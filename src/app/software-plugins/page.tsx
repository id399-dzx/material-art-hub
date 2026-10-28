import type { Metadata } from "next";
import SoftwarePlugins from "@/components/software-plugins/SoftwarePlugins";
import { loadPublicSoftwarePlugins } from "@/lib/software-plugins/public-catalog";
import type { SoftwarePlugin } from "@/lib/software-plugins/catalog";

export const metadata: Metadata = {
  title: "软件插件 · Fesilent Reverie",
  description: "Fesilent Reverie 自研软件插件，查看中文功能介绍、适用环境与安装说明，下载管理员发布的安装包。",
};

export const dynamic = "force-dynamic";

export default async function SoftwarePluginsPage() {
  let initialPlugins: SoftwarePlugin[] | undefined;
  let initialLoadError: string | undefined;
  try {
    initialPlugins = await loadPublicSoftwarePlugins();
  } catch {
    initialLoadError = "插件目录暂时无法读取，请稍后点击重新加载。";
  }
  return <SoftwarePlugins initialPlugins={initialPlugins} initialLoadError={initialLoadError} />;
}
