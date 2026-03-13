import Link from "next/link";

import { ReportView } from "@/components/crypto/report-view";
import { StatusCard } from "@/components/platform/status-card";
import { Button } from "@/components/ui/button";
import { fetchCoins, fetchIntelligenceReportByDate, fetchReportByDate, fetchReportDateNews } from "@/lib/crypto/api";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

type CryptoReportDatePageProps = {
  lang: Language;
  date: string;
};

export async function CryptoReportDatePageContent(props: CryptoReportDatePageProps) {
  const { date, lang } = props;
  const channelT = getFixedT(lang, "channel", "crypto");

  const [coins, report, reportNews, intelligence] = await Promise.all([
    fetchCoins(),
    fetchReportByDate(date),
    fetchReportDateNews(date),
    fetchIntelligenceReportByDate(date)
  ]);

  if (!report) {
    return (
      <StatusCard title={channelT("missingReportTitle")} body={channelT("missingReportDescription")}>
        <Button asChild>
          <Link href={assetHomePath(lang, "crypto")}>{channelT("backToChannelHome")}</Link>
        </Button>
      </StatusCard>
    );
  }

  return (
    <main className="page-shell">
      <ReportView
        lang={lang}
        report={report}
        coins={coins}
        macro={reportNews?.macro ?? null}
        marketNews={reportNews?.marketNews ?? []}
        clusters={reportNews?.clusters ?? []}
        coinNewsByCode={reportNews?.coinNewsByCode ?? {}}
        intelligence={intelligence}
      />
    </main>
  );
}
