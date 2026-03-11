"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { HeroPanel } from "@/components/platform/hero-panel";
import { MetricCard, MetricGrid } from "@/components/platform/metric-grid";
import { NewsSectionCard } from "@/components/crypto/news-section-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CoinItem, CoinNewsItem, DailyReport, MarketNewsItem, NewsClusterItem } from "@/lib/crypto/types";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/crypto/format";
import type { Language } from "@/lib/i18n";
import { assetInstrumentPath } from "@/lib/platform-routes";

type ReportViewProps = {
  lang: Language;
  report: DailyReport;
  coins: CoinItem[];
  marketNews: MarketNewsItem[];
  clusters: NewsClusterItem[];
  coinNewsByCode: Record<string, CoinNewsItem[]>;
};

function getCoinName(coin: CoinItem | undefined, lang: Language): string {
  if (!coin) {
    return "-";
  }
  return lang === "zh" ? coin.nameZh : coin.nameEn;
}

export function ReportView(props: ReportViewProps) {
  const { lang, report, coins } = props;
  const { t } = useTranslation("common");
  const coinByCode = new Map(coins.map((coin) => [coin.code, coin]));
  const focusItems = [...report.items]
    .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct) || b.quoteVolume24hUsdt - a.quoteVolume24hUsdt)
    .slice(0, 3);

  const summary = lang === "zh" ? report.summaryZh : report.summaryEn;

  return (
    <div className="space-y-6">
      <HeroPanel
        eyebrow={t("reportSummaryLabel")}
        title={t("reportTitle")}
        summary={summary}
        badges={
          <>
            <Badge variant="outline">{t("reportDate")}: {formatDate(report.reportDate, lang)}</Badge>
            <Badge variant="outline">{t("generatedAt")}: {formatDateTime(report.generatedAt, lang)}</Badge>
          </>
        }
      />

      <MetricGrid>
        <MetricCard title={t("totalVolume")} value={formatCompactCurrency(report.totalQuoteVolumeUsdt, lang)} />
        <MetricCard
          title={t("breadth")}
          value={t("crypto.breadthSummary", { upCount: report.upCount, downCount: report.downCount, flatCount: report.flatCount })}
          valueClassName="text-base text-muted-foreground"
        />
        <MetricCard
          title={t("leader")}
          value={report.leaderCode ? `${report.leaderCode} ${report.leaderChange24hPct === null ? "" : formatSignedPercent(report.leaderChange24hPct)}` : "-"}
          valueClassName="text-base text-muted-foreground"
        />
        <MetricCard
          title={t("laggard")}
          value={report.laggardCode ? `${report.laggardCode} ${report.laggardChange24hPct === null ? "" : formatSignedPercent(report.laggardChange24hPct)}` : "-"}
          valueClassName="text-base text-muted-foreground"
        />
      </MetricGrid>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("marketSnapshot")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[840px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tableRank")}</TableHead>
                  <TableHead>{t("tableName")}</TableHead>
                  <TableHead>{t("tableCode")}</TableHead>
                  <TableHead className="text-right">{t("tablePrice")}</TableHead>
                  <TableHead className="text-right">{t("tableChange24h")}</TableHead>
                  <TableHead className="text-right">{t("tableVolume24h")}</TableHead>
                  <TableHead className="text-right">{t("tableShare")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => {
                  const coin = coinByCode.get(item.code);
                  return (
                    <TableRow key={`${report.reportDate}-${item.code}`}>
                      <TableCell>{coin?.rank ?? "-"}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={assetInstrumentPath(lang, "crypto", item.code)} className="hover:text-primary hover:underline">
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
          <CardTitle>{t("focusMoves")}</CardTitle>
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
                  {t("crypto.focusMoveSummary", {
                    code: item.code,
                    price: formatPrice(item.priceUsdt, lang),
                    volume: formatCompactCurrency(item.quoteVolume24hUsdt, lang),
                    share: formatShare(item.tradeSharePct)
                  })}
                </p>
              </article>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("crypto.focusCoverageTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {focusItems.every((item) => (props.coinNewsByCode[item.code] ?? []).length === 0) ? (
            <p className="empty">{t("crypto.noFocusCoverage")}</p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-3">
              {focusItems.map((item) => {
                const coin = coinByCode.get(item.code);
                const newsItems = props.coinNewsByCode[item.code] ?? [];
                return (
                  <article key={`focus-news-${item.code}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{getCoinName(coin, lang)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.code}</p>
                      </div>
                      <Badge variant="outline">{newsItems.length}</Badge>
                    </div>

                    {newsItems.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">{t("crypto.noCoinNews")}</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {newsItems.slice(0, 2).map((newsItem) => (
                          <div key={`${item.code}-${newsItem.id}`} className="rounded-xl border border-border/60 bg-background/60 p-3">
                            <a
                              href={newsItem.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                            >
                              {newsItem.title}
                            </a>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {newsItem.source} · {formatDateTime(newsItem.publishedAt, lang)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-foreground/90">
                              {lang === "zh" ? newsItem.summaryZh : newsItem.summaryEn}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <NewsSectionCard
        lang={lang}
        title={t("crypto.marketNewsTitle")}
        emptyText={t("crypto.noMarketNews")}
        items={props.marketNews}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("crypto.eventClustersTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {props.clusters.length === 0 ? (
            <p className="empty">{t("crypto.noMarketNews")}</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {props.clusters.map((cluster) => (
                <article key={`cluster-${cluster.clusterId}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t("crypto.clusterImpact", { impact: cluster.marketImpact })}</Badge>
                    <Badge variant="secondary">{t("crypto.clusterSources", { count: cluster.sourceCount })}</Badge>
                    <Badge variant="outline">{t("crypto.signalLabel")}: {cluster.importanceScore}</Badge>
                  </div>
                  <a
                    href={cluster.representative.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                  >
                    {cluster.label}
                  </a>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {cluster.representative.source} · {formatDateTime(cluster.representative.publishedAt, lang)}
                  </p>
                  {cluster.relatedCoins.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {cluster.relatedCoins.slice(0, 4).map((coinCode) => (
                        <Badge key={`${cluster.clusterId}-${coinCode}`} variant="outline">
                          {coinCode}
                        </Badge>
                      ))}
                      {cluster.topics.slice(0, 2).map((topic) => (
                        <Badge key={`${cluster.clusterId}-${topic}`} variant="secondary">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
