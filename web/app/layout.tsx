import type { Metadata } from "next";
import { Merriweather, Space_Grotesk, Geist } from "next/font/google";

import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang="zh-CN" className={cn("dark", "font-sans", geist.variable)}>
      <body className={`${geist.variable} ${serif.variable}`}>
        <SiteHeader />
        {props.children}
      </body>
    </html>
  );
}
