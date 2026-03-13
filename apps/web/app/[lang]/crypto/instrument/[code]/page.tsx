export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { CryptoInstrumentPageContent } from "@/components/crypto/instrument-page";
import type { Language } from "@/lib/i18n";
import { buildCryptoInstrumentMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language; code: string }>;
}): Promise<Metadata> {
  const { lang, code } = await props.params;
  return buildCryptoInstrumentMetadata(lang, code);
}

export default async function CryptoInstrumentPage(props: {
  params: Promise<{ lang: Language; code: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { lang, code } = await props.params;
  return <CryptoInstrumentPageContent lang={lang} code={code} searchParams={props.searchParams} />;
}
