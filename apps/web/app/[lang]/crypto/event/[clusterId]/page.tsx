export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { CryptoEventPageContent } from "@/components/crypto/event-page";
import type { Language } from "@/lib/i18n";

export default async function CryptoEventPage(props: {
  params: Promise<{ lang: Language; clusterId: string }>;
}) {
  const { lang, clusterId } = await props.params;
  const parsed = Number.parseInt(clusterId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    notFound();
  }

  return <CryptoEventPageContent lang={lang} clusterId={parsed} />;
}
