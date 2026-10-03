import type { Metadata } from "next";
import ManuscriptWorkbench from "@/components/manuscript/ManuscriptWorkbench";

export const metadata: Metadata = { title: "论文排版 · Fesilent 科研工作台", description: "选择期刊并在浏览器本地整理 Word 投稿稿件，保留正文、图表和公式，输出可编辑 DOCX。" };

export default function PaperFormattingPage() { return <ManuscriptWorkbench />; }
