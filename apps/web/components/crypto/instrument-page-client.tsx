"use client";

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
import { fetchCoinDetailClient, fetchCoinNewsClient } from "@/lib/crypto/client-api";
import type { CoinDetail, CoinNewsItem } from "@/lib/crypto/types";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/crypto/format";
import type { Language } from "@/lib/i18n";

type Props = {
  lang: Language;
  code: string;
};

export function InstrumentPageClient(props: Props) {
  const { lang, code } = props;
  const { t } = useTranslation("common");
  const [detail, setDetail] = useState<CoinDetail | null | undefined>(undefined);
  const [newsItems, setNewsItems] = useState<CoinNewsItem[]>([]);
  const [selectedReportDate, setSelectedReportDate] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const loadDetail = useEffectEvent(async () => {
    const nextDetail = await fetchCoinDetailClient(code);
    const initialReportDate = nextDetail?.history[0]?.reportDate ?? null;
    startTransition(() => {
      setDetail(nextDetail);
      setSelectedReportDate(initialReportDate);
      setNewsItems([]);
      setNewsLoading(true);
    });
  });

  const loadNewsForDate = useEffectEvent(async (reportDate: string | null) => {
    setNewsLoading(true);
    const nextNewsItems = await fetchCoinNewsClient(code, 8, 72, reportDate);
    startTransition(() => {
      setNewsItems(nextNewsItems);
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
                    <TableHead className="text-right">{t("tablePrice")}</TableHead>
                    <TableHead className="text-right">{t("tableChange24h")}</TableHead>
                    <TableHead className="text-right">{t("tableVolume24h")}</TableHead>
                    <TableHead className="text-right">{t("tableShare")}</TableHead>
                    <TableHead>{t("generatedAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.history.map((item, index) => (
                    <TableRow key={`${item.reportDate ?? item.closeTime}-${index}`}>
                      <TableCell>{item.reportDate ? formatDate(item.reportDate, lang) : "-"}</TableCell>
                      <TableCell className="text-right">{formatPrice(item.priceUsdt, lang)}</TableCell>
                      <TableCell className={`text-right font-semibold ${item.change24hPct > 0 ? "text-red-400" : item.change24hPct < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {formatSignedPercent(item.change24hPct)}
                      </TableCell>
                      <TableCell className="text-right">{formatCompactCurrency(item.quoteVolume24hUsdt, lang)}</TableCell>
                      <TableCell className="text-right">{formatShare(item.tradeSharePct)}</TableCell>
                      <TableCell>{formatDateTime(item.closeTime, lang)}</TableCell>
                    </TableRow>
                  ))}
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
