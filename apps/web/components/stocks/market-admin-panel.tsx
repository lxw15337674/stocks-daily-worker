"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketAiSummary, MarketIndicesAdminRunResponse } from "@china-stocks/contracts";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientFetchError, clientFetchJson } from "@/lib/client-fetch";
import type { Language } from "@/lib/i18n";
import { stocksMarketPath } from "@/lib/platform-routes";
import { formatMarketTimestamp } from "./market-utils";

type MarketAdminPanelProps = {
  lang: Language;
  onUnauthorized?: () => void;
};

export function MarketAdminPanel(props: MarketAdminPanelProps) {
  const { lang, onUnauthorized } = props;
  const { t } = useTranslation("stocks");
  const [summaries, setSummaries] = useState<MarketAiSummary[]>([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function loadStatus(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const payload = await clientFetchJson<{ items?: MarketAiSummary[] }>("/api/indices/summary/final/latest");
      setSummaries(payload.items ?? []);
    } catch (cause) {
      if (cause instanceof ClientFetchError && cause.status === 401) {
        onUnauthorized?.();
        return;
      }
      setError(cause instanceof Error ? cause.message : t("admin.marketPanelLoadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSync(): Promise<void> {
    setRunning(true);
    setError("");
    setSuccessMessage("");
    try {
      const payload = await clientFetchJson<MarketIndicesAdminRunResponse>("/api/indices/admin/run", {
        method: "GET"
      });
      setSummaries(payload.summaries);
      setSuccessMessage(t("admin.marketPanelRunSuccess", { date: payload.summaryDate }));
    } catch (cause) {
      if (cause instanceof ClientFetchError && cause.status === 401) {
        onUnauthorized?.();
        return;
      }
      setError(cause instanceof Error ? cause.message : t("admin.marketPanelRunFailed"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{t("admin.marketPanelTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("admin.marketPanelDescription")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadStatus()} disabled={loading || running}>
              {t("admin.marketPanelRefresh")}
            </Button>
            <Button size="sm" onClick={() => void runSync()} disabled={running}>
              {running ? t("admin.marketPanelRunning") : t("admin.marketPanelRun")}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={stocksMarketPath(lang)}>{t("admin.marketPanelOpenMarket")}</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("admin.actionFailedTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert variant="success">
            <AlertTitle>{t("admin.actionSucceededTitle")}</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}
        {loading ? (
          <Alert>
            <AlertDescription>{t("admin.loading")}</AlertDescription>
          </Alert>
        ) : null}
        {!loading && summaries.length === 0 ? (
          <Alert>
            <AlertDescription>{t("admin.marketPanelNoSummary")}</AlertDescription>
          </Alert>
        ) : null}
        {summaries.length > 0 ? (
          <div className="space-y-3 rounded-md border border-border/70 bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t("admin.marketPanelLatestStatus")}</Badge>
              <Badge variant="secondary">{summaries[0]?.summaryDate}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {summaries.map((summary) => (
                <div key={`${summary.summaryType}-${summary.region}`} className="space-y-2 rounded-md border border-border/70 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {summary.region === "cn" ? t("market.regionCn") : summary.region === "hk" ? t("market.regionHk") : t("market.regionUs")}
                    </p>
                    <Badge variant="secondary">
                      {summary.summaryType === "intraday" ? t("market.intradaySummaryLabel") : t("market.finalSummaryLabel")}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{t("admin.marketPanelLastDate")}: {summary.summaryDate}</p>
                    <p>{t("admin.marketPanelGeneratedAt")}: {formatMarketTimestamp(summary.createdAt, lang)}</p>
                    <p>{t("admin.marketPanelSnapshotCount")}: {summary.snapshotCount}</p>
                    <p>{t("admin.marketPanelModel")}: {summary.model ?? "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
