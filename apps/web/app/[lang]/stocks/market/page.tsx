import MarketPage from "@/components/stocks/pages/market-page";
import type { Language } from "@/lib/i18n";

export default async function StocksMarketPage(props: {
  params: Promise<{ lang: Language }>;
  searchParams: Promise<{ range?: string; indexKeys?: string; summaryDate?: string }>;
}) {
  const { lang } = await props.params;
  return <MarketPage lang={lang} searchParams={props.searchParams} />;
}
