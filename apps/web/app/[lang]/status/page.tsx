import StatusPage from "@/components/platform/pages/status-page";
import type { Language } from "@/lib/i18n";
import { loadPlatformStatusPageData } from "@/lib/platform-status";

export default async function LocalizedStatusPage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  const data = await loadPlatformStatusPageData();

  return <StatusPage lang={lang} data={data} />;
}
