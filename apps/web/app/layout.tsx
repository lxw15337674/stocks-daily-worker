import type { Metadata } from "next";

import "./globals.css";
import { SwrProvider } from "@/components/providers/swr-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  title: "Market Daily",
  description: "Unified multi-asset daily market platform for stocks, crypto, and upcoming asset channels."
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <body>
        <SwrProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
            {props.children}
          </ThemeProvider>
        </SwrProvider>
      </body>
    </html>
  );
}
