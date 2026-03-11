import Link from "next/link";

import { StatusCard } from "@/components/platform/status-card";
import { Button } from "@/components/ui/button";
import { HomeContentTabs } from "@/components/home-content-tabs";
import { fetchReportList, fetchStockDetails, fetchStockList, fetchStockReportByDate } from "@/lib/api";
import { addDaysToReportDate, isValidReportDate, toReadableDate } from "@/lib/date";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath, assetInstrumentPath } from "@/lib/platform-routes";
import { buildParsedRowsFromStockReport, resolveLocalizedText } from "@/lib/stocks-report";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type HomePageProps = {
  lang?: Language;
  searchParams: Promise<{ date?: string }>;
};

function getTodayEtDateString(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function calculateLatestStreak(changeValues: Array<number | null>): { direction: "up" | "down" | "flat"; count: number } {
  const firstValid = changeValues.find((value) => value !== null) ?? null;
  if (firstValid === null) {
    return { direction: "flat", count: 0 };
  }
  if (firstValid === 0) {
    return { direction: "flat", count: 1 };
  }

  const direction = firstValid > 0 ? "up" : "down";
  let count = 0;
  for (const value of changeValues) {
    if (value === null) {
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

function calculateRecentReturn(closeValues: number[], windowSize: number): number | null {
  if (closeValues.length < 2) {
    return null;
  }

  const ordered = closeValues.filter((value) => Number.isFinite(value));
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

function countDirectionalDays(changeValues: Array<number | null>, windowSize: number, direction: "up" | "down"): number {
  return changeValues
    .slice(0, windowSize)
    .filter((value) => value !== null)
    .filter((value) => (direction === "up" ? (value ?? 0) > 0 : (value ?? 0) < 0)).length;
}

function countRecentNewsByDays(publishedAtValues: string[], reportDate: string, windowDays: number): number {
  const reportEnd = new Date(`${reportDate}T23:59:59Z`);
  if (Number.isNaN(reportEnd.getTime())) {
    return 0;
  }

  const windowStart = reportEnd.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return publishedAtValues.filter((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    const timestamp = date.getTime();
    return timestamp >= windowStart && timestamp <= reportEnd.getTime();
  }).length;
}

export default async function HomePage(props: HomePageProps) {
  const lang = props.lang ?? "zh";
  const channelT = getFixedT(lang, "channel", "stocks");
  const { date: queryDateRaw } = await props.searchParams;
  const queryDate = queryDateRaw?.trim() ?? "";

  const historyPromise = fetchReportList(120);
  const stockItemsPromise = fetchStockList();
  const history = await historyPromise;

  const date = isValidReportDate(queryDate) ? queryDate : history[0]?.reportDateEt ?? getTodayEtDateString();

  const [report, stockItems] = await Promise.all([fetchStockReportByDate(date), stockItemsPromise]);
  if (!report) {
    return (
      <StatusCard title={channelT("missingReportTitle")} body={channelT("missingReportDescription")}>
        <Button asChild>
          <Link href={assetHomePath(lang, "stocks")}>{channelT("backToChannelHome")}</Link>
        </Button>
      </StatusCard>
    );
  }

  const previousDate = addDaysToReportDate(date, -1);
  const nextDate = addDaysToReportDate(date, 1);
  const reportRows = buildParsedRowsFromStockReport(report, lang);
  const stockItemBySymbol = new Map(stockItems.map((item) => [item.symbol, item]));

  const tableSymbols = Array.from(
    new Set(
      reportRows
        .map((row) => row.symbol)
        .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0)
    )
  );
  const stockDetails = await fetchStockDetails(tableSymbols);
  const detailBySymbol = new Map(stockDetails.map((detail) => [detail.stock.symbol, detail]));
  const streakBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, calculateLatestStreak((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.changePct))])
  );
  const recentFiveDayReturnBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, calculateRecentReturn((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.close), 5)])
  );
  const recentPositiveDaysBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, countDirectionalDays((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.changePct), 5, "up")])
  );
  const recentNegativeDaysBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, countDirectionalDays((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.changePct), 5, "down")])
  );
  const recentFiveDayNewsCountBySymbol = new Map(
    tableSymbols.map((symbol) => [
      symbol,
      countRecentNewsByDays((detailBySymbol.get(symbol)?.recentNews ?? []).map((item) => item.publishedAt), date, 5)
    ])
  );

  const enhancedRows: ParsedReportStockRow[] =
    reportRows.map((row) => ({
      ...row,
      businessType: row.symbol ? (stockItemBySymbol.get(row.symbol)?.businessType ?? null) : null,
      detailUrl: row.symbol ? assetInstrumentPath(lang, "stocks", row.symbol) : row.detailUrl,
      newsCount: row.symbol ? (row.newsCount ?? 0) : 0,
      streak: row.symbol ? (streakBySymbol.get(row.symbol) ?? { direction: "flat", count: 0 }) : { direction: "flat", count: 0 },
      recentFiveDayReturn: row.symbol ? (recentFiveDayReturnBySymbol.get(row.symbol) ?? null) : null,
      recentFiveDayNewsCount: row.symbol ? (recentFiveDayNewsCountBySymbol.get(row.symbol) ?? 0) : 0,
      recentPositiveDays: row.symbol ? (recentPositiveDaysBySymbol.get(row.symbol) ?? 0) : 0,
      recentNegativeDays: row.symbol ? (recentNegativeDaysBySymbol.get(row.symbol) ?? 0) : 0
    }));

  return (
    <main className="page-shell">
      <HomeContentTabs
        lang={lang}
        date={date}
        readableDate={toReadableDate(date, lang)}
        rows={enhancedRows}
        previousDate={previousDate}
        nextDate={nextDate}
        overview={{
          stock: resolveLocalizedText(report.overview.stock, lang),
          news: resolveLocalizedText(report.overview.news, lang)
        }}
        newsGroups={report.newsGroups.map((group) => ({
          ...group,
          detailUrl: assetInstrumentPath(lang, "stocks", group.symbol)
        }))}
        reportMeta={{
          generatedAt: report.createdAt,
          sampleScope: String(report.sampleSize),
          validQuotes: String(report.validQuoteCount)
        }}
      />
    </main>
  );
}
