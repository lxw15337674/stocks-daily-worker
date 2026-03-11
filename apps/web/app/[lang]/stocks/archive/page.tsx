import ArchivePage from "@/components/stocks/pages/archive-page";
import type { Language } from "@/lib/i18n";

export default async function StocksArchivePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  return <ArchivePage lang={lang} />;
}
