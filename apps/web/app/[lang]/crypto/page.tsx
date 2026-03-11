export const dynamic = "force-dynamic";

import { HomePageClient } from "@/components/crypto/home-page-client";
import type { Language } from "@/lib/i18n";

export default async function CryptoHomePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <HomePageClient lang={lang} />;
}
