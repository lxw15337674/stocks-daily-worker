"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { NotFoundView } from "@/components/platform/not-found-view";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { isValidReportDate } from "@/lib/date";
import { assetHomePath } from "@/lib/platform-routes";
import type { Language } from "@/lib/i18n";

type ReportDatePageProps = {
  lang?: Language;
  date: string;
};

export default function ReportDatePage(props: ReportDatePageProps) {
  const router = useRouter();
  const lang = props.lang ?? "zh";
  const date = props.date?.trim();

  useEffect(() => {
    if (!date || !isValidReportDate(date)) {
      return;
    }

    router.replace(`${assetHomePath(lang, "stocks")}?date=${encodeURIComponent(date)}`);
  }, [date, lang, router]);

  if (!date || !isValidReportDate(date)) {
    return <NotFoundView lang={lang} />;
  }

  return <RouteSegmentLoading title="Redirecting" description="Opening the requested report date." />;
}

