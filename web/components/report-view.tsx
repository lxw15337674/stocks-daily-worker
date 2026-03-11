"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CoinItem, DailyReport } from "@/lib/crypto-types";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/format";
import { getDictionary, type Language } from "@/lib/i18n";

type ReportViewProps = {
  lang: Language;
  report: DailyReport;
  coins: CoinItem[];
};

function getCoinName(coin: CoinItem | undefined, lang: Language): string {
  if (!coin) {
    return "-";
  }
  return lang === "zh" ? coin.nameZh : coin.nameEn;
}

export function ReportView(props: ReportViewProps) {
  const { lang, report, coins } = props;
  const dict = getDictionary(lang);
  const coinByCode = new Map(coins.map((coin) => [coin.code, coin]));
  const focusItems = [...report.items]
    .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct) || b.quoteVolume24hUsdt - a.quoteVolume24hUsdt)
    .slice(0, 3);

  const summary = lang === "zh" ? report.summaryZh : report.summaryEn;

  return (
    <div className="space-y-6">
      <Card className="hero-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="eyebrow">{dict.reportSummaryLabel}</p>
              <CardTitle className="mt-2 text-3xl">{dict.reportTitle}</CardTitle>
              <p className="hero-summary">{summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{dict.reportDate}: {formatDate(report.reportDate, lang)}</Badge>
              <Badge variant="outline">{dict.generatedAt}: {formatDateTime(report.generatedAt, lang)}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.totalVolume}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCompactCurrency(report.totalQuoteVolumeUsdt, lang)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.breadth}</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-muted-foreground">
            {lang === "zh"
              ? `上涨 ${report.upCount} / 下跌 ${report.downCount} / 持平 ${report.flatCount}`
              : `Up ${report.upCount} / Down ${report.downCount} / Flat ${report.flatCount}`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.leader}</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-muted-foreground">
            {report.leaderCode ? `${report.leaderCode} ${report.leaderChange24hPct === null ? "" : formatSignedPercent(report.leaderChange24hPct)}` : "-"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.laggard}</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-muted-foreground">
            {report.laggardCode ? `${report.laggardCode} ${report.laggardChange24hPct === null ? "" : formatSignedPercent(report.laggardChange24hPct)}` : "-"}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{dict.marketSnapshot}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[840px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.tableRank}</TableHead>
                  <TableHead>{dict.tableName}</TableHead>
                  <TableHead>{dict.tableCode}</TableHead>
                  <TableHead className="text-right">{dict.tablePrice}</TableHead>
                  <TableHead className="text-right">{dict.tableChange24h}</TableHead>
                  <TableHead className="text-right">{dict.tableVolume24h}</TableHead>
                  <TableHead className="text-right">{dict.tableShare}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => {
                  const coin = coinByCode.get(item.code);
                  return (
                    <TableRow key={`${report.reportDate}-${item.code}`}>
                      <TableCell>{coin?.rank ?? "-"}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/${lang}/coin/${item.code}`} className="hover:text-primary hover:underline">
                          {getCoinName(coin, lang)}
                        </Link>
                      </TableCell>
                      <TableCell>{item.code}</TableCell>
                      <TableCell className="text-right">{formatPrice(item.priceUsdt, lang)}</TableCell>
                      <TableCell className={`text-right font-semibold ${item.change24hPct > 0 ? "text-red-400" : item.change24hPct < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {formatSignedPercent(item.change24hPct)}
                      </TableCell>
                      <TableCell className="text-right">{formatCompactCurrency(item.quoteVolume24hUsdt, lang)}</TableCell>
                      <TableCell className="text-right">{formatShare(item.tradeSharePct)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{dict.focusMoves}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-3">
          {focusItems.map((item) => {
            const coin = coinByCode.get(item.code);
            return (
              <article key={`focus-${item.code}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{getCoinName(coin, lang)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.code}</p>
                  </div>
                  <p className={`text-lg font-semibold ${item.change24hPct > 0 ? "text-red-400" : item.change24hPct < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {formatSignedPercent(item.change24hPct)}
                  </p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {lang === "zh"
                    ? `${item.code} 当前价格 ${formatPrice(item.priceUsdt, lang)}，24 小时交易额 ${formatCompactCurrency(item.quoteVolume24hUsdt, lang)}，在观察池中的交易占比为 ${formatShare(item.tradeSharePct)}。`
                    : `${item.code} is trading at ${formatPrice(item.priceUsdt, lang)} with ${formatCompactCurrency(item.quoteVolume24hUsdt, lang)} of 24h traded value, representing ${formatShare(item.tradeSharePct)} of the tracked universe.`}
                </p>
              </article>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
