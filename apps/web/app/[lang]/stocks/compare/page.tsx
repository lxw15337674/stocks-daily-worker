import type { Metadata } from "next";

import type { Language } from "@/lib/i18n";
import { buildStocksCompareMetadata } from "@/lib/route-metadata";
import ComparePage from "@/components/stocks/pages/compare-page";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildStocksCompareMetadata(lang);
}

export default async function LocalizedStocksComparePage(props: {
  params: Promise<{ lang: Language }>;
  searchParams: Promise<{ date?: string; compareDate?: string }>;
}) {
  const { lang } = await props.params;

  return <ComparePage lang={lang} searchParams={props.searchParams} />;
}
