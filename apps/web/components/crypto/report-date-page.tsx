"use client";

import Link from "next/link";

import { ReportView } from "@/components/crypto/report-view";
import { NotFoundView } from "@/components/platform/not-found-view";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { StatusCard } from "@/components/platform/status-card";
import { Button } from "@/components/ui/button";
import { useCoins, useIntelligenceReportByDate, useMarketBoard, useReportByDate, useReportDateNews } from "@/lib/crypto/api";
import { isValidReportDate } from "@/lib/date";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

type CryptoReportDatePageProps = {
  lang: Language;
  date: string;
};

export function CryptoReportDatePageContent(props: CryptoReportDatePageProps) {
  const { date, lang } = props;
  const channelT = getFixedT(lang, "channel", "crypto");

  if (!isValidReportDate(date)) {
    return <NotFoundView lang={lang} />;
  }

  const { data: coins = [], isLoading: isCoinsLoading } = useCoins();
  const { data: report, isLoading: isReportLoading } = useReportByDate(date);
  const { data: reportNews, isLoading: isReportNewsLoading } = useReportDateNews(date);
  const { data: intelligence, isLoading: isIntelligenceLoading } = useIntelligenceReportByDate(date);
  const { data: marketBoard, isLoading: isMarketBoardLoading } = useMarketBoard(date);

  if (isCoinsLoading || isReportLoading || isReportNewsLoading || isIntelligenceLoading || isMarketBoardLoading) {
    return <RouteSegmentLoading title="Loading crypto report" description={channelT("loading")} />;
  }

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
        marketBoard={marketBoard ?? null}
        macro={reportNews?.macro ?? null}
        marketNews={reportNews?.marketNews ?? []}
        clusters={reportNews?.clusters ?? []}
        coinNewsByCode={reportNews?.coinNewsByCode ?? {}}
        intelligence={intelligence ?? null}
      />
    </main>
  );
}
