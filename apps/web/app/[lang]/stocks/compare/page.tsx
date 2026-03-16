"use client";

import { useParams, useSearchParams } from "next/navigation";

import ComparePage from "@/components/stocks/pages/compare-page";
import { resolveLanguage } from "@/lib/i18n";

export default function LocalizedStocksComparePage() {
  const params = useParams<{ lang?: string }>();
  const searchParams = useSearchParams();
  const lang = resolveLanguage(params?.lang);

  return (
    <ComparePage
      lang={lang}
      date={searchParams.get("date") ?? undefined}
      compareDate={searchParams.get("compareDate") ?? undefined}
    />
  );
}

