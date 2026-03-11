export const dynamic = "force-dynamic";

import { ArchivePageClient } from "@/components/crypto/archive-page-client";
import type { Language } from "@/lib/i18n";

export default async function CryptoArchivePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <ArchivePageClient lang={lang} />;
}
