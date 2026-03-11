export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { ReportDatePageClient } from "@/components/crypto/report-date-page-client";
import type { Language } from "@/lib/i18n";

export default async function CryptoReportDatePage(props: {
  params: Promise<{ lang: Language; date: string }>;
}) {
  const { lang, date } = await props.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  return <ReportDatePageClient lang={lang} date={date} />;
}
