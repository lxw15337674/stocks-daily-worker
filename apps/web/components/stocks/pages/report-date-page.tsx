import { notFound, redirect } from "next/navigation";

import { isValidReportDate } from "@/lib/date";
import { assetHomePath } from "@/lib/platform-routes";
import type { Language } from "@/lib/i18n";

type ReportDatePageProps = {
  lang?: Language;
  params: Promise<{ date: string }>;
};

export default async function ReportDatePage(props: ReportDatePageProps) {
  const lang = props.lang ?? "zh";
  const { date: rawDate } = await props.params;
  const date = rawDate?.trim();
  if (!date || !isValidReportDate(date)) {
    notFound();
  }

  redirect(`${assetHomePath(lang, "stocks")}?date=${encodeURIComponent(date)}`);
}
