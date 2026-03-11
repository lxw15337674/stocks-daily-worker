import type { Language } from "@/lib/i18n";
import ComparePage from "@/components/stocks/pages/compare-page";

export default async function LocalizedStocksComparePage(props: {
  params: Promise<{ lang: Language }>;
  searchParams: Promise<{ date?: string; compareDate?: string }>;
}) {
  const { lang } = await props.params;

  return <ComparePage lang={lang} searchParams={props.searchParams} />;
}
