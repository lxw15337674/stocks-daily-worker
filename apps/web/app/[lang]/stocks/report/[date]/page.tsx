"use client";

import { useParams } from "next/navigation";

import ReportDatePage from "@/components/stocks/pages/report-date-page";
import { resolveLanguage } from "@/lib/i18n";

export default function LocalizedStocksReportDatePage() {
  const params = useParams<{ lang?: string; date?: string }>();
  const lang = resolveLanguage(params?.lang);
  return <ReportDatePage lang={lang} date={params?.date ?? ""} />;
}

