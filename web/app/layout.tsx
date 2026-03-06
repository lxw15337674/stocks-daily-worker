import type { Metadata } from "next";
import { Merriweather, Space_Grotesk } from "next/font/google";

import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"]
});

const serif = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["700", "900"]
});

export const metadata: Metadata = {
  title: "中概日报",
  description: "中概日报网站，支持按日期查询历史报告。"
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${sans.variable} ${serif.variable}`}>{props.children}</body>
    </html>
  );
}
