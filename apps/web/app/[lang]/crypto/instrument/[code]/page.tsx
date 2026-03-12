export const dynamic = "force-dynamic";

import { CryptoInstrumentPageContent } from "@/components/crypto/instrument-page";
import type { Language } from "@/lib/i18n";

export default async function CryptoInstrumentPage(props: {
  params: Promise<{ lang: Language; code: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { lang, code } = await props.params;
  return <CryptoInstrumentPageContent lang={lang} code={code} searchParams={props.searchParams} />;
}
