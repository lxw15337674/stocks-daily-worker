"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeftRight, CalendarDays, ChevronLeft, Newspaper, TrendingUp } from "lucide-react";
import type { TFunction } from "i18next";

import {
  type ReportListItem,
  useReportList,
  useStockList,
  useStockReportByDate
} from "@/lib/api";
import { toReadableDate, isValidReportDate } from "@/lib/date";
import { type ParsedReportStockRow } from "@/lib/report-parser";
import { assetHomePath, assetInstrumentPath, stocksComparePath } from "@/lib/platform-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MetricCard, MetricGrid } from "@/components/platform/metric-grid";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getChangeTextClass } from "@/lib/change-color";
import { getFixedT, type Language } from "@/lib/i18n";
import { buildParsedRowsFromStockReport, resolveLocalizedText } from "@/lib/stocks-report";

type ComparePageProps = {
  lang?: Language;
  date?: string;
  compareDate?: string;
};

type ComparisonRow = {
  key: string;
  company: string;
  symbol: string | null;
  detailUrl: string | null;
  currentCloseText: string;
  previousCloseText: string;
  currentChangeText: string;
  previousChangeText: string;
  currentChangeValue: number | null;
  previousChangeValue: number | null;
  deltaValue: number | null;
  currentNewsCount: number;
};

function formatSignedPct(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatAbsPct(value: number): string {
  return `${Math.abs(value).toFixed(2)}%`;
}

function countLabel(t: TFunction<"stocks", "compare">, count: number): string {
  return t("nameCount", { count });
}

function formatNameList(t: TFunction<"stocks", "compare">, names: string[]): string {
  if (names.length === 0) {
    return t("noneLabel");
  }

  return names.join(t("listSeparator"));
}

function changeTextClass(lang: Language, value: number | null): string {
  return getChangeTextClass(lang, value);
}

function pickDistinctDates(items: ReportListItem[]): string[] {
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const item of items) {
    if (seen.has(item.reportDateEt)) {
      continue;
    }
    seen.add(item.reportDateEt);
    dates.push(item.reportDateEt);
  }
  return dates;
}

function resolveDate(input: string | undefined, availableDates: string[], fallbackIndex: number): string | null {
  const normalized = input?.trim() ?? "";
  if (normalized && isValidReportDate(normalized)) {
    return normalized;
  }
  return availableDates[fallbackIndex] ?? null;
}

function buildComparisonRows(currentRows: ParsedReportStockRow[], previousRows: ParsedReportStockRow[]): ComparisonRow[] {
  const previousByKey = new Map(previousRows.map((row) => [row.symbol ?? row.company, row]));
  const rows: ComparisonRow[] = [];

  for (const row of currentRows) {
    const key = row.symbol ?? row.company;
    const previous = previousByKey.get(key);
    if (!previous) {
      continue;
    }

    rows.push({
      key,
      company: row.company,
      symbol: row.symbol,
      detailUrl: row.detailUrl,
      currentCloseText: row.closeText,
      previousCloseText: previous.closeText,
      currentChangeText: row.changeText,
      previousChangeText: previous.changeText,
      currentChangeValue: row.changeValue,
      previousChangeValue: previous.changeValue,
      deltaValue: row.changeValue !== null && previous.changeValue !== null ? row.changeValue - previous.changeValue : null,
      currentNewsCount: row.newsCount ?? 0
    });
  }

  return rows.sort((a, b) => Math.abs(b.deltaValue ?? 0) - Math.abs(a.deltaValue ?? 0));
}

function findUniqueRows(sourceRows: ParsedReportStockRow[], comparisonRows: ParsedReportStockRow[]): ParsedReportStockRow[] {
  const comparisonKeys = new Set(comparisonRows.map((row) => row.symbol ?? row.company));
  return sourceRows.filter((row) => !comparisonKeys.has(row.symbol ?? row.company)).slice(0, 6);
}

function summarizeAiChanges(
  t: TFunction<"stocks", "compare">,
  date: string,
  compareDate: string,
  currentBrief: string | null,
  comparisonRows: ComparisonRow[],
  newlyAdded: ParsedReportStockRow[],
  removed: ParsedReportStockRow[]
): string[] {
  const avgDelta =
    comparisonRows.length > 0
      ? comparisonRows.reduce((sum, row) => sum + (row.deltaValue ?? 0), 0) / comparisonRows.length
      : null;
  const stronger = comparisonRows.filter((row) => (row.deltaValue ?? 0) > 0).slice(0, 2).map((row) => row.company);
  const weaker = comparisonRows.filter((row) => (row.deltaValue ?? 0) < 0).slice(0, 2).map((row) => row.company);

  const stockSummary =
    avgDelta === null
      ? t("summaryNoOverlap", { date, compareDate })
      : avgDelta > 0
        ? t("summaryImproved", { date, compareDate, delta: formatAbsPct(avgDelta) })
        : avgDelta < 0
          ? t("summaryWeakened", { date, compareDate, delta: formatAbsPct(avgDelta) })
          : t("summaryFlat");

  const leadershipSummary = t("leadershipSummary", {
    stronger: formatNameList(t, stronger),
    weaker: formatNameList(t, weaker)
  });

  const overviewSummary = t("overviewSummary", {
    brief: currentBrief ?? t("noMorningBrief")
  });

  const coverageSummary = t("coverageSummary", {
    date,
    compareDate,
    newlyAdded: newlyAdded.length,
    removed: removed.length
  });

  return [stockSummary, leadershipSummary, overviewSummary, coverageSummary];
}

function renderCompanyCell(row: { company: string; detailUrl: string | null }) {
  if (!row.detailUrl) {
    return <span className="font-medium">{row.company}</span>;
  }

  return (
    <Link href={row.detailUrl} className="font-medium hover:text-primary">
      {row.company}
    </Link>
  );
}

export default function ComparePage(props: ComparePageProps) {
  const lang = props.lang ?? "zh";
  const t = getFixedT(lang, "stocks", "compare");
  const dateRaw = props.date;
  const compareDateRaw = props.compareDate;
  const { data: history = [], isLoading: isHistoryLoading } = useReportList(120);
  const { data: stockItems = [], isLoading: isStockItemsLoading } = useStockList();
  const stockItemBySymbol = new Map(stockItems.map((item) => [item.symbol, item]));
  const availableDates = pickDistinctDates(history);

  const date = resolveDate(dateRaw, availableDates, 0);
  const compareDate = resolveDate(compareDateRaw, availableDates, 1);

  const { data: currentReport, isLoading: isCurrentLoading } = useStockReportByDate(date);
  const { data: previousReport, isLoading: isPreviousLoading } = useStockReportByDate(compareDate);

  if (isHistoryLoading || isStockItemsLoading || isCurrentLoading || isPreviousLoading) {
    return <RouteSegmentLoading title="Loading comparison" description={t("loading")} />;
  }

  if (!date || !compareDate) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>{t("emptyHistoryTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <Button asChild variant="outline">
                <Link href={assetHomePath(lang, "stocks")}>{t("backHome")}</Link>
              </Button>
            </Empty>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!currentReport || !previousReport) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>{t("missingReportsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyDescription>{t("missingReportsDescription")}</EmptyDescription>
              <Button asChild variant="outline">
                <Link href={assetHomePath(lang, "stocks")}>{t("backHome")}</Link>
              </Button>
            </Empty>
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentBrief = resolveLocalizedText(currentReport.overview.brief, lang);
  const previousBrief = resolveLocalizedText(previousReport.overview.brief, lang);

  const currentRows = useMemo(
    () =>
      buildParsedRowsFromStockReport(currentReport, lang).map((row) => ({
        ...row,
        detailUrl: row.symbol ? assetInstrumentPath(lang, "stocks", row.symbol) : row.detailUrl,
        businessType: row.symbol ? (stockItemBySymbol.get(row.symbol)?.businessType ?? null) : null,
        newsCount: row.symbol ? (row.newsCount ?? 0) : 0
      })),
    [currentReport, lang, stockItemBySymbol]
  );
  const previousRows = useMemo(
    () =>
      buildParsedRowsFromStockReport(previousReport, lang).map((row) => ({
        ...row,
        detailUrl: row.symbol ? assetInstrumentPath(lang, "stocks", row.symbol) : row.detailUrl,
        businessType: row.symbol ? (stockItemBySymbol.get(row.symbol)?.businessType ?? null) : null
      })),
    [previousReport, lang, stockItemBySymbol]
  );

  const comparisonRows = buildComparisonRows(currentRows, previousRows);
  const newlyAdded = findUniqueRows(currentRows, previousRows);
  const removed = findUniqueRows(previousRows, currentRows);
  const improvedCount = comparisonRows.filter((row) => (row.deltaValue ?? 0) > 0).length;
  const summaryItems = summarizeAiChanges(t, date, compareDate, currentBrief, comparisonRows, newlyAdded, removed);
  const watchRows = comparisonRows.slice(0, 3);

  return (
    <main className="page-shell">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-3">
                <Button asChild variant="ghost" size="sm" className="px-0">
                  <Link href={assetHomePath(lang, "stocks")}>
                    <ChevronLeft className="h-4 w-4" />
                    {t("backHome")}
                  </Link>
                </Button>
                <div className="space-y-2">
                  <CardTitle className="text-3xl">{t("pageTitle")}</CardTitle>
                  <p className="meta">{t("pageSubtitle", { date, compareDate })}</p>
                </div>
              </div>

              <form method="get" action={stocksComparePath(lang)} className="grid w-full max-w-xl gap-3 rounded-xl border bg-background/40 p-4 md:grid-cols-[1fr_1fr_auto]">
                <FieldGroup className="gap-0">
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="compare-date-current">
                        {t("currentReportLabel")}
                      </FieldLabel>
                      <Input id="compare-date-current" name="date" type="date" defaultValue={date} required />
                    </FieldContent>
                  </Field>
                </FieldGroup>
                <FieldGroup className="gap-0">
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="compare-date-previous">
                        {t("compareReportLabel")}
                      </FieldLabel>
                      <Input id="compare-date-previous" name="compareDate" type="date" defaultValue={compareDate} required />
                    </FieldContent>
                  </Field>
                </FieldGroup>
                <div className="flex items-end">
                  <Button type="submit" className="w-full gap-1.5">
                    <ArrowLeftRight className="h-4 w-4" />
                    {t("updateComparison")}
                  </Button>
                </div>
              </form>
            </div>
          </CardHeader>
        </Card>

        <MetricGrid>
          <MetricCard title={t("overlapTitle")} value={countLabel(t, comparisonRows.length)} description={t("overlapDescription")} />
          <MetricCard title={t("improvedTitle")} value={countLabel(t, improvedCount)} description={t("improvedDescription")} />
          <MetricCard title={t("newSamplesTitle")} value={countLabel(t, newlyAdded.length)} description={t("newSamplesDescription", { date })} />
          <MetricCard title={t("droppedSamplesTitle")} value={countLabel(t, removed.length)} description={t("droppedSamplesDescription", { date: compareDate })} />
        </MetricGrid>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">{t("aiSummaryTitle")}</CardTitle>
              <Badge variant="secondary">{t("comparisonNotesBadge")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryItems.map((item, index) => (
              <div key={`summary-${index}`} className="rounded-xl border bg-background/40 p-4">
                <p className="leading-7 text-foreground/90">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">{t("watchlistTitle")}</CardTitle>
              <Badge variant="outline">{t("watchlistBadge")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {watchRows.length === 0 ? (
              <Empty className="border border-dashed border-border/70 bg-background/20 py-8 md:col-span-3">
                <EmptyHeader>
                  <EmptyTitle>{t("watchlistEmpty")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              watchRows.map((row) => (
                <div key={row.key} className="rounded-xl border bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{t("deltaPriorityBadge")}</Badge>
                    <span className={`text-sm font-semibold ${changeTextClass(lang, row.deltaValue)}`}>{formatSignedPct(row.deltaValue)}</span>
                  </div>
                  <div className="mt-2">
                    {renderCompanyCell(row)}
                    <p className="mt-1 text-xs text-muted-foreground">{row.symbol ?? t("unmappedSymbol")}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground/90">
                    {t("watchSummary", {
                      company: row.company,
                      currentChangeText: row.currentChangeText,
                      deltaText: formatSignedPct(row.deltaValue),
                      newsCount: row.currentNewsCount
                    })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{t("aiOverviewTitle", { date })}</CardTitle>
                <Badge variant="outline">{toReadableDate(date, lang)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-foreground/90">{currentBrief ?? t("noMorningBrief")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{t("aiOverviewTitle", { date: compareDate })}</CardTitle>
                <Badge variant="outline">{toReadableDate(compareDate, lang)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-foreground/90">{previousBrief ?? t("noMorningBrief")}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4" />
                {t("changeBoardTitle")}
              </CardTitle>
              <p className="meta">{t("changeBoardDescription")}</p>
            </div>
          </CardHeader>
          <CardContent>
            {comparisonRows.length === 0 ? (
              <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                <EmptyHeader>
                  <EmptyTitle>{t("noOverlapSamples")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("companyColumn")}</TableHead>
                      <TableHead>{date}</TableHead>
                      <TableHead>{compareDate}</TableHead>
                      <TableHead className="text-right">{t("changeDeltaColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.slice(0, 20).map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>
                          {renderCompanyCell(row)}
                          <div className="mt-1 text-xs text-muted-foreground">{row.symbol ?? t("unmappedSymbol")}</div>
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{row.currentCloseText}</div>
                          <div className={`text-xs ${changeTextClass(lang, row.currentChangeValue)}`}>{row.currentChangeText}</div>
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{row.previousCloseText}</div>
                          <div className={`text-xs ${changeTextClass(lang, row.previousChangeValue)}`}>{row.previousChangeText}</div>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${changeTextClass(lang, row.deltaValue)}`}>{formatSignedPct(row.deltaValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                <CalendarDays className="mr-2 inline h-4 w-4" />
                {t("onlyInTitle", { date })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {newlyAdded.length === 0 ? (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                  <EmptyHeader>
                    <EmptyTitle>{t("noNewSamples")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                newlyAdded.map((row, index) => (
                  <div key={`added-${row.symbol ?? row.company}-${index}`} className="rounded-xl border bg-background/40 p-3">
                    {renderCompanyCell(row)}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.closeText} · <span className={changeTextClass(lang, row.changeValue)}>{row.changeText}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                <Newspaper className="mr-2 inline h-4 w-4" />
                {t("onlyInTitle", { date: compareDate })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {removed.length === 0 ? (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                  <EmptyHeader>
                    <EmptyTitle>{t("noDroppedSamples")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                removed.map((row, index) => (
                  <div key={`removed-${row.symbol ?? row.company}-${index}`} className="rounded-xl border bg-background/40 p-3">
                    {renderCompanyCell(row)}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.closeText} · <span className={changeTextClass(lang, row.changeValue)}>{row.changeText}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
