import type { Language } from "@/lib/i18n";
import AdminPage from "@/components/stocks/pages/admin-page";

export default async function LocalizedStocksAdminPage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;

  return <AdminPage lang={lang} />;
}
