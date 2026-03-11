export const dynamic = "force-dynamic";

import { InstrumentPageClient } from "@/components/crypto/instrument-page-client";
import type { Language } from "@/lib/i18n";

export default async function CryptoInstrumentPage(props: {
  params: Promise<{ lang: Language; code: string }>;
}) {
  const { lang, code } = await props.params;
  return <InstrumentPageClient lang={lang} code={code} />;
}
