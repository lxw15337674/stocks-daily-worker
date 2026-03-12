export const dynamic = "force-dynamic";

import { CryptoArchivePageContent } from "@/components/crypto/archive-page";
import type { Language } from "@/lib/i18n";

export default async function CryptoArchivePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <CryptoArchivePageContent lang={lang} />;
}
