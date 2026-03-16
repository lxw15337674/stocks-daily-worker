"use client";

import { useParams } from "next/navigation";

import { CryptoEventPageContent } from "@/components/crypto/event-page";
import { resolveLanguage } from "@/lib/i18n";

export default function CryptoEventPage() {
  const params = useParams<{ lang?: string; clusterId?: string }>();
  const lang = resolveLanguage(params?.lang);
  const parsed = Number.parseInt(params?.clusterId ?? "", 10);

  return <CryptoEventPageContent lang={lang} clusterId={parsed} />;
}
