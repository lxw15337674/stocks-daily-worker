export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { CryptoArchivePageContent } from "@/components/crypto/archive-page";
import type { Language } from "@/lib/i18n";
import { buildAssetArchiveMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildAssetArchiveMetadata(lang, "crypto");
}

export default async function CryptoArchivePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <CryptoArchivePageContent lang={lang} />;
}
