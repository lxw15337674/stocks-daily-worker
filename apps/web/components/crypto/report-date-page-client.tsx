"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { StatusCard } from "@/components/platform/status-card";
import { ReportView } from "@/components/crypto/report-view";
import { fetchCoinsClient, fetchReportByDateClient, fetchReportDateNewsClient } from "@/lib/crypto/client-api";
import type { CoinItem, CoinNewsItem, DailyReport, MarketNewsItem, NewsClusterItem } from "@/lib/crypto/types";
import type { Language } from "@/lib/i18n";

type Props = {
  lang: Language;
  date: string;
};

type ReportState = {
  coins: CoinItem[];
  report: DailyReport | null;
  marketNews: MarketNewsItem[];
  clusters: NewsClusterItem[];
  coinNewsByCode: Record<string, CoinNewsItem[]>;
  loading: boolean;
};

export function ReportDatePageClient(props: Props) {
  const { lang, date } = props;
  const { t } = useTranslation("common");
  const [state, setState] = useState<ReportState>({
    coins: [],
    report: null,
    marketNews: [],
    clusters: [],
    coinNewsByCode: {},
    loading: true
  });

  const loadReport = useEffectEvent(async () => {
    const [coins, report, reportNews] = await Promise.all([
      fetchCoinsClient(),
      fetchReportByDateClient(date),
      fetchReportDateNewsClient(date)
    ]);
    startTransition(() => {
      setState({
        coins,
        report,
        marketNews: reportNews?.marketNews ?? [],
        clusters: reportNews?.clusters ?? [],
        coinNewsByCode: reportNews?.coinNewsByCode ?? {},
        loading: false
      });
    });
  });

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (state.loading) {
    return <StatusCard title={t("reportTitle")} body={t("loading")} />;
  }

  if (!state.report) {
    return <StatusCard title={t("reportTitle")} body={t("noData")} />;
  }

  return (
    <main className="page-shell">
      <ReportView
        lang={lang}
        report={state.report}
        coins={state.coins}
        marketNews={state.marketNews}
        clusters={state.clusters}
        coinNewsByCode={state.coinNewsByCode}
      />
    </main>
  );
}
