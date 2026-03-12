export const dynamic = "force-dynamic";

import { CryptoHomePageContent } from "@/components/crypto/home-page";
import type { Language } from "@/lib/i18n";

export default async function CryptoHomePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <CryptoHomePageContent lang={lang} />;
}
