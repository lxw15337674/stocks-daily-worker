import type { Metadata } from "next";

import ArchivePage from "@/components/stocks/pages/archive-page";
import type { Language } from "@/lib/i18n";
import { buildAssetArchiveMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildAssetArchiveMetadata(lang, "stocks");
}

export default async function StocksArchivePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <ArchivePage lang={lang} />;
}
