import type { Metadata } from "next";
import { Geist, Merriweather, Inter } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body className={`${inter.variable} ${serif.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {props.children}
        </ThemeProvider>
      </body>
    </html>
  );
}
