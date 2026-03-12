import type { Language } from "@/lib/i18n";
import StockDetailPage from "@/components/stocks/pages/instrument-page";

export default async function LocalizedStockInstrumentPage(props: {
  params: Promise<{ lang: Language; symbol: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const { lang, symbol } = await props.params;

  return StockDetailPage({ lang, params: Promise.resolve({ symbol }), searchParams: props.searchParams });
}
