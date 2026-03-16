"use client";

import { useParams } from "next/navigation";

import { CryptoReportDatePageContent } from "@/components/crypto/report-date-page";
import { resolveLanguage } from "@/lib/i18n";

export default function CryptoReportDatePage() {
  const params = useParams<{ lang?: string; date?: string }>();
  const lang = resolveLanguage(params?.lang);

  return <CryptoReportDatePageContent lang={lang} date={params?.date ?? ""} />;
}
