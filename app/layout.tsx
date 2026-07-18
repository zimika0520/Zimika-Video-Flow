import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shin-video",
  description: "Local article audio video renderer",
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
