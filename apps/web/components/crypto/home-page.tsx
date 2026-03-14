import Link from "next/link";

import { ReportView } from "@/components/crypto/report-view";
import { StatusCard } from "@/components/platform/status-card";
import { Button } from "@/components/ui/button";
import { fetchCoins, fetchHomeSnapshot } from "@/lib/crypto/api";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

type CryptoHomePageProps = {
  lang: Language;
};

export async function CryptoHomePageContent(props: CryptoHomePageProps) {
  const { lang } = props;
  const channelT = getFixedT(lang, "channel", "crypto");

  const [coins, snapshot] = await Promise.all([fetchCoins(), fetchHomeSnapshot()]);

  if (!snapshot) {
    return (
      <StatusCard title={channelT("missingReportTitle")} body={channelT("missingReportDescription")}>
        <Button asChild>
          <Link href={assetHomePath(lang, "crypto")}>{channelT("backToChannelHome")}</Link>
        </Button>
      </StatusCard>
    );
  }

  const { report, reportNews, intelligence } = snapshot;

  return (
    <main className="page-shell">
      <ReportView
        lang={lang}
        report={report}
        coins={coins}
        macro={reportNews.macro}
        marketNews={reportNews.marketNews}
        clusters={reportNews.clusters}
        coinNewsByCode={reportNews.coinNewsByCode}
        intelligence={intelligence}
      />
    </main>
  );
}
