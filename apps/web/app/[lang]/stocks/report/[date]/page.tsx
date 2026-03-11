import type { Language } from "@/lib/i18n";
import ReportDatePage from "@/components/stocks/pages/report-date-page";

export default async function LocalizedStocksReportDatePage(props: {
  params: Promise<{ lang: Language; date: string }>;
}) {
  const { lang, date } = await props.params;

  return ReportDatePage({ lang, params: Promise.resolve({ date }) });
}
