export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { CryptoHomePageContent } from "@/components/crypto/home-page";
import type { Language } from "@/lib/i18n";
import { buildAssetHomeMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildAssetHomeMetadata(lang, "crypto");
}

export default async function CryptoHomePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <CryptoHomePageContent lang={lang} />;
}
