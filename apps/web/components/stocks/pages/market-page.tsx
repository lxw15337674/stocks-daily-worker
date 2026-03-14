import Link from "next/link";
import { ChevronLeft, Globe2, LineChart, Newspaper } from "lucide-react";

import { MarketChartClient } from "@/components/stocks/market-chart-client";
import { MarketStatusGrid } from "@/components/stocks/market-status-grid";
import {
  formatMarketMove,
  formatMarketPrice,
  formatMarketTimestamp,
  getMarketChangeTextClass,
  hasMarketContent
} from "@/components/stocks/market-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath, stocksAdminPath, stocksMarketPath } from "@/lib/platform-routes";
import { buildMarketPageSearch, loadMarketPageData } from "@/lib/stocks-market";

type MarketPageProps = {
  lang?: Language;
  searchParams?: Promise<{ range?: string; indexKeys?: string; summaryDate?: string }>;
};

function resolveSummaryText(
  lang: Language,
  summary: Awaited<ReturnType<typeof loadMarketPageData>>["summary"]
): string | null {
  if (!summary) {
    return null;
  }

  return (lang === "zh" ? summary.summaryZh : summary.summaryEn) ?? summary.summaryZh ?? summary.summaryEn ?? null;
}

export default async function MarketPage(props: MarketPageProps) {
  const lang = props.lang ?? "zh";
  const t = getFixedT(lang, "stocks", "market");
  const commonT = getFixedT(lang, "common");
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { history, initialRange, latest, requestedSummaryDate, selectedIndexKeys, summary } =
    await loadMarketPageData(searchParams);

  const summaryText = resolveSummaryText(lang, summary);
  const items = latest?.regions.flatMap((region) => region.items) ?? [];
  const summaryDateValue = requestedSummaryDate ?? summary?.summaryDate ?? "";
  const latestSummaryHref = `${stocksMarketPath(lang)}?${buildMarketPageSearch({
    range: initialRange,
    indexKeys: selectedIndexKeys
  })}`;

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
                    <CardTitle className="text-3xl">{t("pageTitle")}</CardTitle>
                    <Badge variant="outline">{t("liveBadge")}</Badge>
                  </div>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{t("pageSubtitle")}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                {latest?.updatedAt ? (
                  <div className="rounded-md border border-border/70 bg-background/45 px-4 py-3 text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("updatedAtLabel")}</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{formatMarketTimestamp(latest.updatedAt, lang)}</p>
                  </div>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href={stocksAdminPath(lang)}>{t("adminLinkLabel")}</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              <CardTitle className="text-lg">{t("latestTitle")}</CardTitle>
            </div>
            <p className="meta">{t("latestDescription")}</p>
          </CardHeader>
          <CardContent>
            {hasMarketContent(latest, summary) ? (
              <MarketStatusGrid lang={lang} latest={latest} compact />
            ) : (
              <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                <EmptyHeader>
                  <EmptyTitle>{t("noSummary")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              <CardTitle className="text-lg">{t("summaryTitle")}</CardTitle>
            </div>
            <p className="meta">{t("summaryDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={stocksMarketPath(lang)} method="get" className="flex flex-wrap items-end gap-3 rounded-md border border-border/70 bg-background/30 p-3">
              <input type="hidden" name="range" value={initialRange} />
              <input type="hidden" name="indexKeys" value={selectedIndexKeys.join(",")} />
              <FieldGroup className="min-w-[220px] flex-1 gap-0">
                <Field className="gap-1">
                  <FieldContent>
                    <FieldLabel htmlFor="market-summary-date" className="text-xs text-muted-foreground">
                      {t("summaryArchiveLabel")}
                    </FieldLabel>
                    <Input id="market-summary-date" type="date" name="summaryDate" defaultValue={summaryDateValue} />
                  </FieldContent>
                </Field>
              </FieldGroup>
              <Button type="submit" size="sm">
                {t("summaryArchiveApply")}
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={latestSummaryHref}>{t("summaryArchiveLatest")}</Link>
              </Button>
            </form>

            <div className="rounded-md border border-border/70 bg-background/45 p-4">
              <p className="leading-7 text-foreground/90">{summaryText ?? t("noSummary")}</p>
            </div>
            {requestedSummaryDate && !summary ? (
              <p className="text-sm text-muted-foreground">{t("summaryMissingForDate", { date: requestedSummaryDate })}</p>
            ) : null}
            {summary ? (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 px-2.5 py-1">
                  {commonT("reportDate")}: {summary.summaryDate}
                </span>
                <span className="rounded-full border border-border/70 px-2.5 py-1">
                  {commonT("generatedAt")}: {formatMarketTimestamp(summary.createdAt, lang)}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              <CardTitle className="text-lg">{t("chartTitle")}</CardTitle>
            </div>
            <p className="meta">{t("chartDescription")}</p>
          </CardHeader>
          <CardContent>
            <MarketChartClient
              lang={lang}
              latest={latest}
              initialRange={initialRange}
              initialHistory={history}
              initialSelectedKeys={selectedIndexKeys}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("latestTitle")}</CardTitle>
            <p className="meta">{t("latestDescription")}</p>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                <EmptyHeader>
                  <EmptyTitle>{t("unavailable")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[780px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{commonT("tableName")}</TableHead>
                      <TableHead>{commonT("tableCode")}</TableHead>
                      <TableHead className="text-right">{t("priceLabel")}</TableHead>
                      <TableHead className="text-right">{t("moveLabel")}</TableHead>
                      <TableHead className="text-right">{t("updatedAtLabel")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.indexKey}>
                        <TableCell>
                          <div className="font-medium">{lang === "zh" ? item.nameZh : item.nameEn}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.isPrimary ? t("primaryLabel") : t("latestLabel")}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.symbol}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatMarketPrice(item.price, item.currency, lang)}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap text-right font-medium ${getMarketChangeTextClass(lang, item.region, item.changePct)}`}>
                          {formatMarketMove(item.changePct)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                          {formatMarketTimestamp(item.quoteTimestamp, lang)}
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
