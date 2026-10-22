import type { Metadata } from "next";
import "./globals.css";
import "@/components/resources/resources.css";

export const metadata: Metadata = {
  title: "Fesilent — 电池资讯与科研工作台",
  description: "电池科研资讯、企业目录、科研素材、数据处理与工具工作台",
};

import Header from "@/components/Header";
import ContentProvider from "@/components/admin/ContentProvider";

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
        <ContentProvider>
          <Header />
          {children}
        </ContentProvider>
      </body>
    </html>
  );
}
