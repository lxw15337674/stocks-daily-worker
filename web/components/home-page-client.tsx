"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { ReportView } from "@/components/report-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCoinsClient, fetchLatestReportClient } from "@/lib/client-api";
import type { CoinItem, DailyReport } from "@/lib/crypto-types";
import { getDictionary, type Language } from "@/lib/i18n";

type Props = {
  lang: Language;
};

type HomeState = {
  coins: CoinItem[];
  report: DailyReport | null;
  loading: boolean;
};

export function HomePageClient(props: Props) {
  const { lang } = props;
  const dict = getDictionary(lang);
  const [state, setState] = useState<HomeState>({
    coins: [],
    report: null,
    loading: true
  });

  const loadHome = useEffectEvent(async () => {
    const [coins, report] = await Promise.all([fetchCoinsClient(), fetchLatestReportClient()]);
    startTransition(() => {
      setState({ coins, report, loading: false });
    });
  });

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  if (state.loading) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>{dict.latestReport}</CardTitle>
          </CardHeader>
          <CardContent>{lang === "zh" ? "加载中..." : "Loading..."}</CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="page-shell">
      {state.report ? (
        <ReportView lang={lang} report={state.report} coins={state.coins} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{dict.latestReport}</CardTitle>
          </CardHeader>
          <CardContent>{dict.noData}</CardContent>
        </Card>
      )}
    </main>
  );
}
