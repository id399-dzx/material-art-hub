import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaterialArt Hub",
  description: "科研数据处理与素材探索工作台",
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
