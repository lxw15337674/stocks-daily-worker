export const dynamic = "force-dynamic";

import { ArchivePageClient } from "@/components/archive-page-client";
import { isLanguage } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function ArchivePage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  if (!isLanguage(lang)) {
    notFound();
  }

  return <ArchivePageClient lang={lang} />;
}
