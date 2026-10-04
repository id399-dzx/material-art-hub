import type { Metadata } from "next";
import "./globals.css";
import "@/components/resources/resources.css";

export const metadata: Metadata = {
  title: "Fesilent Reverie",
  description: "科研数据处理、科研 Skill、期刊论文排版与软件工具工作台",
};

import Header from "@/components/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`antialiased`}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}
