"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketAiSummary, MarketIndicesAdminRunResponse } from "@china-stocks/contracts";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [summary, setSummary] = useState<MarketAiSummary | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function loadStatus(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/indices/summary/latest", {
        cache: "no-store"
      });
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || t("admin.marketPanelLoadFailed"));
      }

      const payload = (await response.json()) as { item?: MarketAiSummary | null };
      setSummary(payload.item ?? null);
    } catch (cause) {
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
      const response = await fetch("/api/indices/admin/run", {
        method: "GET",
        cache: "no-store"
      });
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || t("admin.marketPanelRunFailed"));
      }

      const payload = (await response.json()) as MarketIndicesAdminRunResponse;
      setSummary(payload.summary);
      setSuccessMessage(t("admin.marketPanelRunSuccess", { date: payload.summaryDate }));
    } catch (cause) {
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
        {!loading && !summary ? (
          <Alert>
            <AlertDescription>{t("admin.marketPanelNoSummary")}</AlertDescription>
          </Alert>
        ) : null}
        {summary ? (
          <div className="space-y-3 rounded-md border border-border/70 bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t("admin.marketPanelLatestStatus")}</Badge>
              <Badge variant="secondary">{summary.summaryDate}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.marketPanelLastDate")}</p>
                <p className="text-sm font-medium">{summary.summaryDate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.marketPanelGeneratedAt")}</p>
                <p className="text-sm font-medium">{formatMarketTimestamp(summary.createdAt, lang)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.marketPanelSnapshotCount")}</p>
                <p className="text-sm font-medium">{summary.snapshotCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.marketPanelModel")}</p>
                <p className="text-sm font-medium">{summary.model ?? "-"}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
