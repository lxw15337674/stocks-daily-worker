import type { Metadata } from "next";

import type { Language } from "@/lib/i18n";
import { buildCryptoAdminMetadata } from "@/lib/route-metadata";
import CryptoAdminPage from "@/components/crypto/admin-page";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildCryptoAdminMetadata(lang);
}

export default async function LocalizedCryptoAdminPage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;

  return <CryptoAdminPage lang={lang} />;
}
