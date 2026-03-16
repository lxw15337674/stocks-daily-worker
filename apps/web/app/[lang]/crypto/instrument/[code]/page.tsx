"use client";

import { useParams, useSearchParams } from "next/navigation";

import { CryptoInstrumentPageContent } from "@/components/crypto/instrument-page";
import { resolveLanguage } from "@/lib/i18n";

export default function CryptoInstrumentPage() {
  const params = useParams<{ lang?: string; code?: string }>();
  const searchParams = useSearchParams();
  const lang = resolveLanguage(params?.lang);

  return (
    <CryptoInstrumentPageContent
      lang={lang}
      code={params?.code ?? ""}
      date={searchParams.get("date") ?? undefined}
    />
  );
}
