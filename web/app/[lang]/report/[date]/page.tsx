export const dynamic = "force-dynamic";

import { ReportDatePageClient } from "@/components/report-date-page-client";
import { isLanguage } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function ReportDatePage(props: {
  params: Promise<{ lang: string; date: string }>;
}) {
  const { lang, date } = await props.params;
  if (!isLanguage(lang)) {
    notFound();
  }

  return <ReportDatePageClient lang={lang} date={date} />;
}
