"use client";

import { useParams, useSearchParams } from "next/navigation";

import MarketPage from "@/components/stocks/pages/market-page";
import { resolveLanguage } from "@/lib/i18n";

export default function StocksMarketPage() {
  const params = useParams<{ lang?: string }>();
  const searchParams = useSearchParams();
  const lang = resolveLanguage(params?.lang);

  return (
    <MarketPage
      lang={lang}
      range={searchParams.get("range") ?? undefined}
      indexKeys={searchParams.get("indexKeys") ?? undefined}
      summaryDate={searchParams.get("summaryDate") ?? undefined}
    />
  );
}

