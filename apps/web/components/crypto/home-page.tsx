"use client";

import Link from "next/link";

import { ReportView } from "@/components/crypto/report-view";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { StatusCard } from "@/components/platform/status-card";
import { Button } from "@/components/ui/button";
import { useCoins, useHomeSnapshot, useMarketBoard } from "@/lib/crypto/api";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

type CryptoHomePageProps = {
  lang: Language;
};

export function CryptoHomePageContent(props: CryptoHomePageProps) {
  const { lang } = props;
  const channelT = getFixedT(lang, "channel", "crypto");
  const { data: coins = [], isLoading: isCoinsLoading } = useCoins();
  const { data: snapshot, isLoading: isSnapshotLoading } = useHomeSnapshot();
  const { data: marketBoard, isLoading: isMarketBoardLoading } = useMarketBoard();

  if (isCoinsLoading || isSnapshotLoading || isMarketBoardLoading) {
    return <RouteSegmentLoading title="Loading crypto" description="Preparing report, archive, and event data." />;
  }

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
        marketBoard={marketBoard ?? null}
        macro={reportNews.macro}
        marketNews={reportNews.marketNews}
        clusters={reportNews.clusters}
        coinNewsByCode={reportNews.coinNewsByCode}
        intelligence={intelligence}
      />
    </main>
  );
}
