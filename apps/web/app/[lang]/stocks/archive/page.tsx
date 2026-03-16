"use client";

import { useParams } from "next/navigation";

import ArchivePage from "@/components/stocks/pages/archive-page";
import { resolveLanguage } from "@/lib/i18n";

export default function StocksArchivePage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  return <ArchivePage lang={lang} />;
}

