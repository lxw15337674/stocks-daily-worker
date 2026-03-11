import type { Metadata } from "next";
import { Merriweather, Geist } from "next/font/google";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const serif = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["700", "900"]
});

export const metadata: Metadata = {
  title: "Crypto Daily",
  description: "Structured crypto daily reports powered by Binance market data and AI summaries."
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable} dark`}>
      <body>{props.children}</body>
    </html>
  );
}
