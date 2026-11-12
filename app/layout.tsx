import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zimika Video Flow",
  description: "Zimika 本地文章转口播视频与 Remotion 渲染工作流",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
