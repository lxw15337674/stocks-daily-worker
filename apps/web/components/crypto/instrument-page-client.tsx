"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { ReportDatePicker } from "@/components/report-date-picker";
import { HeroPanel } from "@/components/platform/hero-panel";
import { MetricCard, MetricGrid } from "@/components/platform/metric-grid";
import { StatusCard } from "@/components/platform/status-card";
import { NewsSectionCard } from "@/components/crypto/news-section-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCoinDetailClient, fetchCoinNewsClient, fetchMacroSnapshotClient } from "@/lib/crypto/client-api";
import type { CoinDetail, CoinNewsItem, CryptoMacroSnapshot } from "@/lib/crypto/types";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/crypto/format";
import type { Language } from "@/lib/i18n";
import { assetEventPath } from "@/lib/platform-routes";

type Props = {
  lang: Language;
  code: string;
};

function renderStance(value: "bullish" | "bearish" | "neutral", t: (key: string) => string): string {
  if (value === "bullish") {
    return t("crypto.stanceBullish");
  }
  if (value === "bearish") {
    return t("crypto.stanceBearish");
  }
  return t("crypto.stanceNeutral");
}

function formatOptionalSignedPercent(value: number | null): string {
  return value === null ? "-" : formatSignedPercent(value);
}

export function InstrumentPageClient(props: Props) {
  const { lang, code } = props;
  const { t } = useTranslation("common");
  const [detail, setDetail] = useState<CoinDetail | null | undefined>(undefined);
  const [macro, setMacro] = useState<CryptoMacroSnapshot | null>(null);
  const [newsItems, setNewsItems] = useState<CoinNewsItem[]>([]);
  const [selectedReportDate, setSelectedReportDate] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const loadDetail = useEffectEvent(async () => {
    const nextDetail = await fetchCoinDetailClient(code);
    const initialReportDate = nextDetail?.history[0]?.reportDate ?? null;
    startTransition(() => {
      setDetail(nextDetail);
      setMacro(null);
      setSelectedReportDate(initialReportDate);
      setNewsItems([]);
      setNewsLoading(true);
    });
  });

  const loadNewsForDate = useEffectEvent(async (reportDate: string | null) => {
    setNewsLoading(true);
    const [nextNewsItems, nextMacro] = await Promise.all([
      fetchCoinNewsClient(code, 8, 72, reportDate),
      fetchMacroSnapshotClient(reportDate)
    ]);
    startTransition(() => {
      setNewsItems(nextNewsItems);
      setMacro(nextMacro);
      setNewsLoading(false);
    });
  });

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (detail === undefined || detail === null) {
      return;
    }
    if (!selectedReportDate) {
      return;
    }
    void loadNewsForDate(selectedReportDate);
  }, [detail, selectedReportDate, loadNewsForDate]);

  if (detail === undefined) {
    return <StatusCard title={code.toUpperCase()} body={t("loading")} />;
  }

  if (!detail) {
    return <StatusCard title={code.toUpperCase()} body={t("noData")} />;
  }

  const name = lang === "zh" ? detail.coin.nameZh : detail.coin.nameEn;
  const corePosition = lang === "zh" ? detail.coin.corePositionZh : detail.coin.corePositionEn;
  const availableDates = detail.history.map((item) => item.reportDate).filter((value): value is string => !!value);
  const defaultReportDate = availableDates[0] ?? null;
  const eventTimelineByDate = new Map<string, typeof detail.eventTimeline>();
  for (const item of detail.eventTimeline) {
    const bucket = eventTimelineByDate.get(item.reportDate) ?? [];
    bucket.push(item);
    eventTimelineByDate.set(item.reportDate, bucket);
  }

  return (
    <main className="page-shell space-y-6">
      <HeroPanel
        eyebrow={detail.coin.code}
        title={name}
        summary={corePosition}
        badges={
          <>
            <Badge variant="outline">#{detail.coin.rank}</Badge>
            <Badge variant="outline">{t("annualShare")}: {formatShare(detail.coin.annualTradeSharePct)}</Badge>
            <Badge variant="outline">{t("annualVolume")}: {formatCompactCurrency(detail.coin.annualQuoteVolumeUsdt, lang)}</Badge>
          </>
        }
      />

      <MetricGrid>
        <MetricCard
          title={t("latestSnapshot")}
          value={detail.latestSnapshot ? formatPrice(detail.latestSnapshot.priceUsdt, lang) : t("noData")}
        />
        <MetricCard
          title={t("tableChange24h")}
          value={detail.latestSnapshot ? formatSignedPercent(detail.latestSnapshot.change24hPct) : t("noData")}
          valueClassName={`text-2xl font-semibold ${
            detail.latestSnapshot && detail.latestSnapshot.change24hPct > 0
              ? "text-red-400"
              : detail.latestSnapshot && detail.latestSnapshot.change24hPct < 0
                ? "text-emerald-400"
                : "text-muted-foreground"
          }`}
        />
        <MetricCard
          title={t("tableVolume24h")}
          value={detail.latestSnapshot ? formatCompactCurrency(detail.latestSnapshot.quoteVolume24hUsdt, lang) : t("noData")}
        />
        <MetricCard
          title={t("generatedAt")}
          value={detail.latestSnapshot ? formatDateTime(detail.latestSnapshot.closeTime, lang) : t("noData")}
          valueClassName="text-base text-muted-foreground"
        />
      </MetricGrid>

      {macro ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("crypto.macroTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{t("crypto.marketRegimeLabel")}:</span>{" "}
              {lang === "zh" ? macro.regime.labelZh : macro.regime.labelEn}
            </p>
            <p>{lang === "zh" ? macro.regime.summaryZh : macro.regime.summaryEn}</p>
            <p>
              <span className="font-medium text-foreground">{t("crypto.fearGreedLabel")}:</span>{" "}
              {macro.fearGreed.value === null ? t("crypto.macroUnavailable") : macro.fearGreed.value.toFixed(0)}
            </p>
            <p>
              <span className="font-medium text-foreground">{t("crypto.btcDominanceLabel")}:</span>{" "}
              {macro.btcDominance.value === null ? t("crypto.macroUnavailable") : `${macro.btcDominance.value.toFixed(1)}%`}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("coinProfile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">{t("tableCode")}:</span> {detail.coin.code}</p>
          <p><span className="font-medium text-foreground">{t("crypto.pairLabel")}:</span> {detail.coin.pair}</p>
          <p><span className="font-medium text-foreground">{t("corePosition")}:</span> {corePosition}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("crypto.eventTimelineTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.eventTimeline.length === 0 ? (
            <p className="empty">{t("crypto.eventTimelineEmpty")}</p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {detail.eventTimeline.map((item) => (
                <article key={`timeline-${item.clusterId}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{renderStance(item.stance, t)}</Badge>
                    <Badge variant="secondary">{t("crypto.clusterImpact", { impact: item.marketImpact })}</Badge>
                    <Badge variant="outline">{t("crypto.clusterSources", { count: item.sourceCount })}</Badge>
                    {item.associationScore !== null ? (
                      <Badge variant="secondary">{t("crypto.associationScoreLabel")}: {item.associationScore}</Badge>
                    ) : null}
                  </div>
                  <Link
                    href={assetEventPath(lang, item.clusterId)}
                    className="mt-3 block text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                  >
                    {item.label}
                  </Link>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(item.reportDate, lang)} · {item.representative.source}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("crypto.eventReactionSameDayLabel")}</p>
                      <p className="mt-2 text-sm font-semibold">{formatOptionalSignedPercent(item.reaction.event.change24hPct)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("crypto.eventReactionNextLabel")}</p>
                      <p className="mt-2 text-sm font-semibold">{formatOptionalSignedPercent(item.reaction.next.returnPct)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("crypto.eventReactionDay3Label")}</p>
                      <p className="mt-2 text-sm font-semibold">{formatOptionalSignedPercent(item.reaction.day3.returnPct)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.relatedCoins.slice(0, 4).map((coinCode) => (
                      <Badge key={`${item.clusterId}-${coinCode}`} variant="outline">
                        {coinCode}
                      </Badge>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("recentHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.history.length === 0 ? (
            <p className="empty">{t("noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reportDate")}</TableHead>
                    <TableHead>{t("crypto.historyEventColumn")}</TableHead>
                    <TableHead className="text-right">{t("tablePrice")}</TableHead>
                    <TableHead className="text-right">{t("tableChange24h")}</TableHead>
                    <TableHead className="text-right">{t("tableVolume24h")}</TableHead>
                    <TableHead className="text-right">{t("tableShare")}</TableHead>
                    <TableHead>{t("generatedAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.history.map((item, index) => {
                    const eventItems = item.reportDate ? eventTimelineByDate.get(item.reportDate) ?? [] : [];
                    return (
                      <TableRow key={`${item.reportDate ?? item.closeTime}-${index}`}>
                        <TableCell>{item.reportDate ? formatDate(item.reportDate, lang) : "-"}</TableCell>
                        <TableCell className="min-w-[240px]">
                          {eventItems.length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {eventItems.map((eventItem) => (
                                <Link
                                  key={`${item.reportDate}-${eventItem.clusterId}`}
                                  href={assetEventPath(lang, eventItem.clusterId)}
                                  className="inline-flex max-w-full items-center rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                >
                                  <span className="truncate">{eventItem.label}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(item.priceUsdt, lang)}</TableCell>
                        <TableCell className={`text-right font-semibold ${item.change24hPct > 0 ? "text-red-400" : item.change24hPct < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                          {formatSignedPercent(item.change24hPct)}
                        </TableCell>
                        <TableCell className="text-right">{formatCompactCurrency(item.quoteVolume24hUsdt, lang)}</TableCell>
                        <TableCell className="text-right">{formatShare(item.tradeSharePct)}</TableCell>
                        <TableCell>{formatDateTime(item.closeTime, lang)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {defaultReportDate ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("crypto.dateScopedNewsLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReportDatePicker
              value={selectedReportDate ?? defaultReportDate}
              onChange={(nextDate) => {
                setSelectedReportDate(nextDate);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("reportDate")}: {selectedReportDate ?? defaultReportDate}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <NewsSectionCard
        lang={lang}
        title={
          selectedReportDate
            ? `${t("crypto.coinNewsTitle")} · ${selectedReportDate}`
            : t("crypto.coinNewsTitle")
        }
        emptyText={newsLoading ? t("loading") : t("crypto.noCoinNews")}
        items={newsItems}
      />
    </main>
  );
}
