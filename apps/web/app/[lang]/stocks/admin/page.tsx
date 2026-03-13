import type { Metadata } from "next";

import type { Language } from "@/lib/i18n";
import { buildStocksAdminMetadata } from "@/lib/route-metadata";
import AdminPage from "@/components/stocks/pages/admin-page";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildStocksAdminMetadata(lang);
}

export default async function LocalizedStocksAdminPage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;

  return <AdminPage lang={lang} />;
}
