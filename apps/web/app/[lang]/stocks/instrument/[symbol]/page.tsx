"use client";

import { useParams, useSearchParams } from "next/navigation";

import StockDetailPage from "@/components/stocks/pages/instrument-page";
import { resolveLanguage } from "@/lib/i18n";

export default function LocalizedStockInstrumentPage() {
  const params = useParams<{ lang?: string; symbol?: string }>();
  const searchParams = useSearchParams();
  const lang = resolveLanguage(params?.lang);

  return (
    <StockDetailPage
      lang={lang}
      symbol={params?.symbol ?? ""}
      compare={searchParams.get("compare") ?? undefined}
    />
  );
}

