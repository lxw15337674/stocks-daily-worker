import type { Metadata } from "next";
import { Geist, Merriweather } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const serif = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["700", "900"]
});

export const metadata: Metadata = {
  title: "Market Daily",
  description: "Unified multi-asset daily market platform for stocks, crypto, and upcoming asset channels."
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className={`${geist.variable} ${serif.variable}`}>{props.children}</body>
    </html>
  );
}
