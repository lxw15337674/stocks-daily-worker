import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  LineChart,
  Newspaper,
  ScanSearch,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { notFound } from "next/navigation";

import { MetricCard, MetricGrid } from "@/components/platform/metric-grid";
import { InstrumentCompareSelect } from "@/components/stocks/instrument-compare-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchStockDetail,
  fetchStockDetails,
  fetchStockList,
  fetchStockReportByDate,
  type LocalizedText,
  type StockDetailResult,
  type StockHistoryPoint
} from "@/lib/api";
import { getChangeTextClass } from "@/lib/change-color";
import { toReadableDate } from "@/lib/date";
import { assetHomePath, assetInstrumentPath } from "@/lib/platform-routes";
import {
  type ParsedReportStockRow
} from "@/lib/report-parser";
import type { TFunction } from "i18next";
import { getFixedT, type Language } from "@/lib/i18n";
import { buildParsedRowsFromStockReport, resolveLocalizedText } from "@/lib/stocks-report";

type StockDetailPageProps = {
  lang?: Language;
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ compare?: string }>;
};

type ComparisonRow = {
  reportDateEt: string;
  primary: StockHistoryPoint;
  secondary: StockHistoryPoint;
  spreadPct: number;
};

type RankedPoolRow = ParsedReportStockRow & {
  newsCount: number;
  streak: {
    direction: "up" | "down" | "flat";
    count: number;
  };
  recentFiveDayReturn: number | null;
};

type RelativeMetric = {
  label: string;
  rank: number | null;
  total: number;
  value: string;
  hint: string;
  tone: "positive" | "negative" | "neutral";
};

function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatSignedPct(value: number): string {
  const rounded = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

function formatCompactNumber(value: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatPublishedAt(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    timeZone: lang === "zh" ? "Asia/Shanghai" : "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function resolveCurrentLanguageText(text: LocalizedText, lang: Language): string | null {
  const value = lang === "zh" ? text.zh : text.en;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildComparisonRows(primary: StockHistoryPoint[], secondary: StockHistoryPoint[]): ComparisonRow[] {
  const secondaryByDate = new Map(secondary.map((item) => [item.reportDateEt, item]));
  return primary
    .filter((item) => secondaryByDate.has(item.reportDateEt))
    .map((item) => {
      const matched = secondaryByDate.get(item.reportDateEt)!;
      return {
        reportDateEt: item.reportDateEt,
        primary: item,
        secondary: matched,
        spreadPct: item.changePct - matched.changePct
      };
    });
}

function summarizeWindow(points: StockHistoryPoint[]): { days: number; returnPct: number } | null {
  if (points.length < 2) {
    return null;
  }

  const ordered = [...points].sort((a, b) => a.reportDateEt.localeCompare(b.reportDateEt));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (first.close === 0) {
    return null;
  }

  return {
    days: ordered.length,
    returnPct: ((last.close - first.close) / first.close) * 100
  };
}

function calculateLatestStreak(changeValues: Array<number | null | undefined>): {
  direction: "up" | "down" | "flat";
  count: number;
} {
  const firstValid = changeValues.find((value) => value !== null && value !== undefined) ?? null;
  if (firstValid === null) {
    return { direction: "flat", count: 0 };
  }
  if (firstValid === 0) {
    return { direction: "flat", count: 1 };
  }

  const direction = firstValid > 0 ? "up" : "down";
  let count = 0;
  for (const value of changeValues) {
    if (value === null || value === undefined) {
      break;
    }
    if (direction === "up" && value > 0) {
      count += 1;
      continue;
    }
    if (direction === "down" && value < 0) {
      count += 1;
      continue;
    }
    break;
  }

  return { direction, count };
}

function calculateRecentReturn(closeValues: Array<number | null | undefined>, windowSize: number): number | null {
  const ordered = closeValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (ordered.length < 2) {
    return null;
  }

  const window = ordered.slice(0, windowSize);
  if (window.length < 2) {
    return null;
  }

  const latest = window[0];
  const oldest = window[window.length - 1];
  if (!oldest) {
    return null;
  }

  return ((latest - oldest) / oldest) * 100;
}

function buildRelativeMetric(options: {
  label: string;
  rows: RankedPoolRow[];
  targetSymbol: string;
  valueText: string;
  hint: string;
  getValue: (row: RankedPoolRow) => number | null;
  tone: "positive" | "negative" | "neutral";
}): RelativeMetric {
  const scored = options.rows
    .map((row) => ({
      symbol: row.symbol,
      value: row.symbol ? options.getValue(row) : null
    }))
    .filter(
      (item): item is { symbol: string | null; value: number } =>
        typeof item.value === "number" && Number.isFinite(item.value)
    )
    .sort((a, b) => b.value - a.value || String(a.symbol).localeCompare(String(b.symbol)));

  const index = scored.findIndex((item) => item.symbol === options.targetSymbol);

  return {
    label: options.label,
    rank: index >= 0 ? index + 1 : null,
    total: scored.length,
    value: options.valueText,
    hint: options.hint,
    tone: options.tone
  };
}

function describeStreak(t: TFunction<"stocks", "instrument">, streak: RankedPoolRow["streak"]): string {
  if (streak.direction === "up" && streak.count > 0) {
    return t("streakUp", { count: streak.count });
  }
  if (streak.direction === "down" && streak.count > 0) {
    return t("streakDown", { count: streak.count });
  }
  if (streak.direction === "flat" && streak.count > 0) {
    return t("flatClose");
  }
  return t("noStreakSignal");
}

function buildPoolRows(
  detailBySymbol: Map<string, StockDetailResult>,
  tableRows: ParsedReportStockRow[],
  newsCountBySymbol: Map<string, number>
): RankedPoolRow[] {
  return tableRows
    .map((row) => {
      if (!row.symbol) {
        return null;
      }

      const stockDetail = detailBySymbol.get(row.symbol);
      return {
        ...row,
        newsCount: newsCountBySymbol.get(row.symbol) ?? 0,
        streak: calculateLatestStreak(stockDetail?.history.map((item) => item.changePct) ?? []),
        recentFiveDayReturn: calculateRecentReturn(stockDetail?.history.map((item) => item.close) ?? [], 5)
      };
    })
    .filter((row): row is RankedPoolRow => row !== null);
}

export default async function StockDetailPage(props: StockDetailPageProps) {
  const lang = props.lang ?? "zh";
  const t = getFixedT(lang, "stocks", "instrument");
  const { symbol: rawSymbol } = await props.params;
  const { compare: rawCompare } = await props.searchParams;
  const symbol = rawSymbol.trim();
  const compareSymbol = rawCompare?.trim() || "";
  const normalizedCompareSymbol =
    compareSymbol && compareSymbol.toUpperCase() !== symbol.toUpperCase() ? compareSymbol : "";

  const [detail, stockItems, compareTarget] = await Promise.all([
    fetchStockDetail(symbol),
    fetchStockList(),
    normalizedCompareSymbol ? fetchStockDetail(normalizedCompareSymbol) : Promise.resolve(null)
  ]);
  if (!detail) {
    notFound();
  }
  const recentNewsSummary = resolveCurrentLanguageText(detail.latestAiSummary, lang);

  let poolRows: RankedPoolRow[] = [];
  if (detail.latestReportDateEt) {
    const latestReport = await fetchStockReportByDate(detail.latestReportDateEt);
    if (latestReport) {
      const newsCountBySymbol = new Map(latestReport.newsGroups.map((item) => [item.symbol, item.items.length]));
      const parsedTable = buildParsedRowsFromStockReport(latestReport, lang);
      const tableSymbols = Array.from(
        new Set(
          parsedTable
            .map((row) => row.symbol)
            .filter((item): item is string => typeof item === "string" && item.length > 0)
        )
      );
      const poolDetails = await fetchStockDetails(tableSymbols);
      const detailBySymbol = new Map(poolDetails.map((item) => [item.stock.symbol, item]));
      poolRows = buildPoolRows(detailBySymbol, parsedTable, newsCountBySymbol);
    }
  }

  const currentPoolRow = poolRows.find((row) => row.symbol === detail.stock.symbol) ?? null;
  const relativeMetrics = currentPoolRow
    ? [
        buildRelativeMetric({
          label: t("dailyChangeLabel"),
          rows: poolRows,
          targetSymbol: detail.stock.symbol,
          valueText: currentPoolRow.changeText || "-",
          hint: t("dailyChangeHint"),
          getValue: (row) => row.changeValue ?? null,
          tone: (currentPoolRow.changeValue ?? 0) > 0 ? "positive" : (currentPoolRow.changeValue ?? 0) < 0 ? "negative" : "neutral"
        }),
        buildRelativeMetric({
          label: t("newsIntensityLabel"),
          rows: poolRows,
          targetSymbol: detail.stock.symbol,
          valueText: t("headlineCount", { count: currentPoolRow.newsCount }),
          hint: t("newsIntensityHint"),
          getValue: (row) => row.newsCount,
          tone: currentPoolRow.newsCount > 0 ? "positive" : "neutral"
        }),
        buildRelativeMetric({
          label: t("strength5dLabel"),
          rows: poolRows,
          targetSymbol: detail.stock.symbol,
          valueText:
            currentPoolRow.recentFiveDayReturn === null ? "-" : formatSignedPct(currentPoolRow.recentFiveDayReturn),
          hint: t("strength5dHint"),
          getValue: (row) => row.recentFiveDayReturn,
          tone:
            (currentPoolRow.recentFiveDayReturn ?? 0) > 0
              ? "positive"
              : (currentPoolRow.recentFiveDayReturn ?? 0) < 0
                ? "negative"
                : "neutral"
        })
      ]
    : [];

  const comparisonRows = compareTarget ? buildComparisonRows(detail.history, compareTarget.history) : [];
  const primaryWindow = summarizeWindow(detail.history);
  const comparisonWindow = compareTarget ? summarizeWindow(comparisonRows.map((item) => item.primary)) : null;
  const secondaryWindow = compareTarget ? summarizeWindow(comparisonRows.map((item) => item.secondary)) : null;
  const relativeSpread =
    comparisonWindow && secondaryWindow ? comparisonWindow.returnPct - secondaryWindow.returnPct : null;

  return (
    <main className="page-shell">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <Button asChild variant="ghost" size="sm" className="px-0">
                  <Link href={assetHomePath(lang, "stocks")}>
                    <ChevronLeft className="h-4 w-4" />
                    {t("backHome")}
                  </Link>
                </Button>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-3xl">{detail.stock.displayName}</CardTitle>
                    <Badge variant="outline">{detail.stock.symbol}</Badge>
                    <Badge variant="secondary">{detail.stock.businessType}</Badge>
                  </div>
                  <p className="meta">{t("codeMapping")}{detail.stock.codes}</p>
                  <p className="meta">
                    {t("latestReport")}
                    {detail.latestReportDateEt
                      ? `${detail.latestReportDateEt} (${toReadableDate(detail.latestReportDateEt, lang)})`
                      : t("notAvailable")}
                  </p>
                </div>
              </div>

              <InstrumentCompareSelect
                lang={lang}
                currentSymbol={detail.stock.symbol}
                compareSymbol={compareTarget?.stock.symbol ?? null}
                options={stockItems
                  .filter((item) => item.symbol !== detail.stock.symbol)
                  .map((item) => ({ symbol: item.symbol, displayName: item.displayName }))}
                label={t("compareLabel")}
                placeholder={t("comparePlaceholder")}
                submitLabel={t("updateCompare")}
                clearLabel={t("clearCompare")}
              />
            </div>
          </CardHeader>
        </Card>

        <MetricGrid>
          <MetricCard
            title={t("latestCloseTitle")}
            value={detail.latestQuote ? formatPrice(detail.latestQuote.close, detail.latestQuote.currency) : t("notAvailable")}
            description={
              <span className={detail.latestQuote ? `font-medium ${getChangeTextClass(lang, detail.latestQuote.changePct)}` : "text-muted-foreground"}>
                {detail.latestQuote ? formatSignedPct(detail.latestQuote.changePct) : t("noChangeData")}
              </span>
            }
          />
          <MetricCard
            title={t("universePositionTitle")}
            value={
              currentPoolRow && relativeMetrics[0]?.rank
                ? t("universeRankValue", { rank: relativeMetrics[0].rank, total: relativeMetrics[0].total })
                : t("notAvailable")
            }
            description={
              currentPoolRow
                ? t("currentDayWithStreak", {
                    changeText: currentPoolRow.changeText || "-",
                    streak: describeStreak(t, currentPoolRow.streak)
                  })
                : t("stockNotMatchedLatestReport")
            }
          />
          <MetricCard
            title={t("recentReportEntriesTitle")}
            value={t("entryCount", { count: detail.reportRecords.length })}
            description={
              detail.reportRecords[0]
                ? t("latestEntryNews", { count: detail.reportRecords[0].newsCount })
                : t("noReportRecordYet")
            }
          />
          <MetricCard
            title={t("newsCoverageTitle")}
            value={t("headlineCount", { count: detail.recentNews.length })}
            description={t("aliasesPrefix") + (detail.stock.aliases.slice(0, 4).join(" / ") || t("notAvailable"))}
          />
        </MetricGrid>

        {currentPoolRow ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ScanSearch className="h-4 w-4" />
                  {t("relativePositionTitle")}
                </CardTitle>
                <Badge variant="outline">{t("universeNames", { count: poolRows.length })}</Badge>
              </div>
              <p className="meta">
                {t("universeSummary", {
                  symbol: detail.stock.symbol,
                  company: currentPoolRow.company,
                  streak: describeStreak(t, currentPoolRow.streak)
                })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {relativeMetrics.map((item) => (
                  <div key={item.label} className="rounded-xl border bg-background/40 p-4">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p
                      className={`mt-2 text-2xl font-semibold ${
                        item.tone === "positive" || item.tone === "negative"
                          ? getChangeTextClass(lang, item.tone === "positive" ? 1 : -1)
                          : "text-foreground"
                      }`}
                    >
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm text-foreground/90">
                      {item.rank
                        ? t("universeRank", { rank: item.rank, total: item.total })
                        : t("noComparableUniverseSample")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-background/40 p-4 text-sm leading-6 text-foreground/90">
                {currentPoolRow.recentFiveDayReturn === null
                  ? t("currentDaySnapshotNo5d", {
                      closeText: currentPoolRow.closeText,
                      changeText: currentPoolRow.changeText || "-",
                      newsCount: currentPoolRow.newsCount
                    })
                  : t("currentDaySnapshot", {
                      closeText: currentPoolRow.closeText,
                      changeText: currentPoolRow.changeText || "-",
                      newsCount: currentPoolRow.newsCount,
                      fiveDayReturn: formatSignedPct(currentPoolRow.recentFiveDayReturn)
                    })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LineChart className="h-4 w-4" />
                {t("aiOverviewTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-foreground/90">
                {resolveLocalizedText(detail.latestAiSummary, lang) ?? t("noAiSummary")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-4 w-4" />
                  {t("recentReportRecordsTitle")}
                </CardTitle>
                <Badge variant="outline">{t("entryCount", { count: detail.reportRecords.length })}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.reportRecords.length === 0 ? (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                  <EmptyHeader>
                    <EmptyTitle>{t("noReportRecords")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                detail.reportRecords.map((item) => (
                  <article key={`${item.reportDateEt}-${item.close}`} className="rounded-xl border bg-background/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`${assetHomePath(lang, "stocks")}?date=${encodeURIComponent(item.reportDateEt)}`}
                          className="font-medium hover:text-primary"
                        >
                          {item.reportDateEt}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">{toReadableDate(item.reportDateEt, lang)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {detail.latestQuote ? formatPrice(item.close, detail.latestQuote.currency) : item.close.toFixed(2)}
                        </p>
                        <p className={`mt-1 text-xs font-medium ${getChangeTextClass(lang, item.changePct)}`}>
                          {formatSignedPct(item.changePct)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/70 px-2.5 py-1">
                        {t("newsBadge", { count: item.newsCount })}
                      </span>
                      <span className="rounded-full border border-border/70 px-2.5 py-1">
                        {t("reportRecapNode")}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-foreground/90">
                      {resolveLocalizedText(item.aiSummary, lang) ?? t("noItemAiSummary")}
                    </p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Newspaper className="h-4 w-4" />
              {t("recentNewsTitle")}
            </CardTitle>
            {recentNewsSummary ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("recentNewsSummaryLabel")}
                </p>
                <p className="text-sm leading-6 text-foreground/90">{recentNewsSummary}</p>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.recentNews.length === 0 ? (
              <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                <EmptyHeader>
                  <EmptyTitle>{t("noRecentNews")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              detail.recentNews.map((item) => (
                <article key={`${item.link}-${item.publishedAt}`} className="rounded-xl border bg-background/40 p-3">
                  <a href={item.link} target="_blank" rel="noreferrer" className="font-medium leading-6 hover:text-primary">
                    {item.title}
                  </a>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{formatPublishedAt(item.publishedAt, lang)}</span>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        {compareTarget ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  {t("comparisonSummaryTitle", { primary: detail.stock.symbol, secondary: compareTarget.stock.symbol })}
                </CardTitle>
                <Badge variant="outline">{t("overlapSessions", { count: comparisonRows.length })}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    {t("periodReturnLabel", { symbol: detail.stock.symbol })}
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${comparisonWindow ? getChangeTextClass(lang, comparisonWindow.returnPct) : "text-muted-foreground"}`}
                  >
                    {comparisonWindow ? formatSignedPct(comparisonWindow.returnPct) : t("notAvailable")}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    {t("periodReturnLabel", { symbol: compareTarget.stock.symbol })}
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${secondaryWindow ? getChangeTextClass(lang, secondaryWindow.returnPct) : "text-muted-foreground"}`}
                  >
                    {secondaryWindow ? formatSignedPct(secondaryWindow.returnPct) : t("notAvailable")}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">{t("relativeOutperformanceLabel")}</p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${relativeSpread !== null ? getChangeTextClass(lang, relativeSpread) : "text-muted-foreground"}`}
                  >
                    {relativeSpread !== null ? formatSignedPct(relativeSpread) : t("notAvailable")}
                  </p>
                </div>
              </div>

              {comparisonRows.length === 0 ? (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                  <EmptyHeader>
                    <EmptyTitle>{t("noOverlapHistory")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("dateColumn")}</TableHead>
                        <TableHead>{detail.stock.symbol}</TableHead>
                        <TableHead>{compareTarget.stock.symbol}</TableHead>
                        <TableHead>{t("dailySpreadColumn")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonRows.slice(0, 12).map((item) => (
                        <TableRow key={`compare-${item.reportDateEt}`}>
                          <TableCell>{item.reportDateEt}</TableCell>
                          <TableCell>
                            <div className="whitespace-nowrap">{formatPrice(item.primary.close, item.primary.currency)}</div>
                            <div className={`text-xs ${getChangeTextClass(lang, item.primary.changePct)}`}>
                              {formatSignedPct(item.primary.changePct)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="whitespace-nowrap">{formatPrice(item.secondary.close, item.secondary.currency)}</div>
                            <div className={`text-xs ${getChangeTextClass(lang, item.secondary.changePct)}`}>
                              {formatSignedPct(item.secondary.changePct)}
                            </div>
                          </TableCell>
                          <TableCell className={getChangeTextClass(lang, item.spreadPct)}>
                            {formatSignedPct(item.spreadPct)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-4 w-4" />
                {t("priceHistoryTitle")}
              </CardTitle>
              <p className="meta">{t("latestSessions", { count: detail.history.length })}</p>
            </div>
          </CardHeader>
          <CardContent>
            {detail.history.length === 0 ? (
              <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                <EmptyHeader>
                  <EmptyTitle>{t("noHistory")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("dateColumn")}</TableHead>
                      <TableHead className="text-right">{t("closeColumn")}</TableHead>
                      <TableHead className="text-right">{t("prevCloseColumn")}</TableHead>
                      <TableHead className="text-right">{t("changeColumn")}</TableHead>
                      <TableHead className="text-right">{t("volumeColumn")}</TableHead>
                      <TableHead className="text-right">{t("estTurnoverColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.history.map((item) => (
                      <TableRow key={item.reportDateEt}>
                        <TableCell>
                          <div>{item.reportDateEt}</div>
                          <div className="text-xs text-muted-foreground">{toReadableDate(item.reportDateEt, lang)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatPrice(item.close, item.currency)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatPrice(item.previousClose, item.currency)}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap text-right font-medium ${getChangeTextClass(lang, item.changePct)}`}>
                          {item.changePct > 0 ? (
                            <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                          ) : item.changePct < 0 ? (
                            <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                          ) : null}
                          {formatSignedPct(item.changePct)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCompactNumber(item.volume, lang)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatCompactNumber(item.turnoverEstimate, lang)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
