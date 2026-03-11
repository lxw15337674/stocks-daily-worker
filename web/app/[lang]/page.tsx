export const dynamic = "force-dynamic";

import { HomePageClient } from "@/components/home-page-client";
import { getDictionary, isLanguage } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function LocalizedHomePage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  if (!isLanguage(lang)) {
    notFound();
  }

  getDictionary(lang);
  return <HomePageClient lang={lang} />;
}
