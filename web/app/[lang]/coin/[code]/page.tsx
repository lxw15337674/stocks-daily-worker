export const dynamic = "force-dynamic";

import { CoinDetailPageClient } from "@/components/coin-detail-page-client";
import { isLanguage } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function CoinDetailPage(props: {
  params: Promise<{ lang: string; code: string }>;
}) {
  const { lang, code } = await props.params;
  if (!isLanguage(lang)) {
    notFound();
  }

  return <CoinDetailPageClient lang={lang} code={code} />;
}
