import type { Metadata } from "next";

import HomePage from "@/components/stocks/pages/home-page";
import type { Language } from "@/lib/i18n";
import { buildAssetHomeMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildAssetHomeMetadata(lang, "stocks");
}

export default async function StocksHomePage(props: {
  params: Promise<{ lang: Language }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { lang } = await props.params;
  return <HomePage lang={lang} searchParams={props.searchParams} />;
}
