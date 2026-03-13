import type { Metadata } from "next";

import type { Language } from "@/lib/i18n";
import { buildStockInstrumentMetadata } from "@/lib/route-metadata";
import StockDetailPage from "@/components/stocks/pages/instrument-page";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language; symbol: string }>;
}): Promise<Metadata> {
  const { lang, symbol } = await props.params;
  return buildStockInstrumentMetadata(lang, symbol);
}

export default async function LocalizedStockInstrumentPage(props: {
  params: Promise<{ lang: Language; symbol: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const { lang, symbol } = await props.params;

  return StockDetailPage({ lang, params: Promise.resolve({ symbol }), searchParams: props.searchParams });
}
