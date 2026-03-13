import Link from "next/link";
import type { IntelligenceItem, IntelligenceTimelineAnchor, IntelligenceWallResponse } from "@china-stocks/contracts";

import { HeroPanel } from "@/components/platform/hero-panel";
import { MetricCard, MetricGrid } from "@/components/platform/metric-grid";
import { NewsSectionCard } from "@/components/crypto/news-section-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getChangeTextClass } from "@/lib/change-color";
import type { CoinItem, CoinNewsItem, CryptoMacroSnapshot, DailyReport, MarketNewsItem, NewsClusterItem } from "@/lib/crypto/types";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/crypto/format";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetEventPath, assetInstrumentPath } from "@/lib/platform-routes";

type ReportViewProps = {
  lang: Language;
  report: DailyReport;
  coins: CoinItem[];
  macro: CryptoMacroSnapshot | null;
  marketNews: MarketNewsItem[];
  clusters: NewsClusterItem[];
  coinNewsByCode: Record<string, CoinNewsItem[]>;
  intelligence: IntelligenceWallResponse | null;
};

const INTELLIGENCE_COPY = {
  zh: {
    title: "AI 情报墙",
    subtitle: "按情绪分栏展示高价值线索，顶部优先级更高。",
    bullish: "利好",
    neutral: "中性",
    bearish: "利空",
    moverTitle: "异动因果链",
    moverSubtitle: "优先聚焦 24 小时绝对涨跌幅超过 5% 的标的，并附上主因与支撑线索。",
    mainCause: "主因",
    supporting: "支撑线索",
    openInstrument: "查看标的联动",
    openEvent: "打开事件详情",
    timeline: "时间锚点",
    noItems: "暂无情报线索",
    noMovers: "暂无超过 5% 的异动标的",
    importance: "重要度",
    marketTarget: "加密市场"
  },
  en: {
    title: "AI Intelligence Wall",
    subtitle: "Curated signals grouped by sentiment, with higher-priority items pinned near the top.",
    bullish: "Bullish",
    neutral: "Neutral",
    bearish: "Bearish",
    moverTitle: "Mover Diagnostics",
    moverSubtitle: "Focus on assets moving more than 5% in 24h, with a primary cause and supporting evidence.",
    mainCause: "Primary cause",
    supporting: "Supporting evidence",
    openInstrument: "Open asset linkage",
    openEvent: "Open event detail",
    timeline: "Timeline anchors",
    noItems: "No intelligence items yet",
    noMovers: "No movers above the 5% threshold",
    importance: "Importance",
    marketTarget: "Crypto Market"
  }
} as const;

function getCoinName(coin: CoinItem | undefined, lang: Language): string {
  if (!coin) {
    return "-";
  }
  return lang === "zh" ? coin.nameZh : coin.nameEn;
}

function formatMacroValue(snapshot: CryptoMacroSnapshot["fearGreed"] | CryptoMacroSnapshot["btcDominance"], lang: Language): string {
  if (snapshot.value === null) {
    return "-";
  }
  if (snapshot.unit === "percent") {
    return `${snapshot.value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0
  }).format(snapshot.value);
}

function formatMacroChange(snapshot: CryptoMacroSnapshot["fearGreed"] | CryptoMacroSnapshot["btcDominance"]): string {
  if (snapshot.change === null) {
    return "0.00";
  }
  return snapshot.change > 0 ? `+${snapshot.change.toFixed(2)}` : snapshot.change.toFixed(2);
}

function renderMacroStatus(snapshot: CryptoMacroSnapshot["fearGreed"], t: (key: string) => string): string {
  if (snapshot.status === "stale") {
    return t("crypto.macroStale");
  }
  if (snapshot.status === "unavailable") {
    return t("crypto.macroUnavailable");
  }
  return t("crypto.macroLive");
}

function renderStance(value: "bullish" | "bearish" | "neutral", t: (key: string) => string): string {
  if (value === "bullish") {
    return t("crypto.stanceBullish");
  }
  if (value === "bearish") {
    return t("crypto.stanceBearish");
  }
  return t("crypto.stanceNeutral");
}

function renderIntelligenceHeading(lang: Language, sentiment: -1 | 0 | 1): string {
  const copy = INTELLIGENCE_COPY[lang];
  if (sentiment > 0) {
    return copy.bullish;
  }
  if (sentiment < 0) {
    return copy.bearish;
  }
  return copy.neutral;
}

function resolveSentimentCardClass(sentiment: -1 | 0 | 1): string {
  if (sentiment > 0) {
    return "border-emerald-500/30 bg-emerald-500/8";
  }
  if (sentiment < 0) {
    return "border-rose-500/30 bg-rose-500/8";
  }
  return "border-sky-500/20 bg-sky-500/6";
}

function resolveSentimentBadgeClass(sentiment: -1 | 0 | 1): string {
  if (sentiment > 0) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (sentiment < 0) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

function groupTimelineAnchors(anchors: IntelligenceTimelineAnchor[], assetCode: string): IntelligenceTimelineAnchor[] {
  return anchors.filter((anchor) => anchor.assetCode === assetCode).slice(0, 3);
}

function resolveIntelligenceTarget(item: IntelligenceItem, lang: Language): string {
  return lang === "zh" ? item.targetLabelZh : item.targetLabelEn;
}

export function ReportView(props: ReportViewProps) {
  const { intelligence, lang, report, coins, macro } = props;
  const t = getFixedT(lang, "common");
  const intelligenceCopy = INTELLIGENCE_COPY[lang];
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

      {macro ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{t("crypto.macroTitle")}</CardTitle>
              <Badge variant="secondary">{lang === "zh" ? macro.regime.labelZh : macro.regime.labelEn}</Badge>
              <Badge variant="outline">
                {macro.asOf ? `${t("generatedAt")}: ${formatDateTime(macro.asOf, lang)}` : t("crypto.macroUnavailable")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {lang === "zh" ? macro.regime.summaryZh : macro.regime.summaryEn}
            </p>
            <div className="grid gap-3 xl:grid-cols-2">
              <article className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{t("crypto.fearGreedLabel")}</p>
                  <Badge variant="outline">{renderMacroStatus(macro.fearGreed, t)}</Badge>
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">{formatMacroValue(macro.fearGreed, lang)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {macro.fearGreed.classification ?? t("crypto.macroUnavailable")} · {t("crypto.previousDeltaLabel")}: {formatMacroChange(macro.fearGreed)}
                </p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{t("crypto.btcDominanceLabel")}</p>
                  <Badge variant="outline">{renderMacroStatus(macro.btcDominance, t)}</Badge>
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">{formatMacroValue(macro.btcDominance, lang)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("crypto.previousDeltaLabel")}: {formatMacroChange(macro.btcDominance)}
                </p>
              </article>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                      <TableCell className={`text-right font-semibold ${getChangeTextClass(lang, item.change24hPct)}`}>
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
                  <p className={`text-lg font-semibold ${getChangeTextClass(lang, item.change24hPct)}`}>
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
          <CardTitle>{intelligenceCopy.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{intelligence?.overview ? (lang === "zh" ? intelligence.overview.zh : intelligence.overview.en) : intelligenceCopy.subtitle}</p>
        </CardHeader>
        <CardContent>
          {intelligence && (intelligence.columns.bullish.length > 0 || intelligence.columns.neutral.length > 0 || intelligence.columns.bearish.length > 0) ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {([1, 0, -1] as const).map((sentiment) => {
                const items = sentiment > 0
                  ? intelligence.columns.bullish
                  : sentiment < 0
                    ? intelligence.columns.bearish
                    : intelligence.columns.neutral;
                return (
                  <section key={`wall-${sentiment}`} className={`rounded-3xl border p-4 ${resolveSentimentCardClass(sentiment)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-foreground">{renderIntelligenceHeading(lang, sentiment)}</h3>
                      <Badge variant="outline" className={resolveSentimentBadgeClass(sentiment)}>{items.length}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{intelligenceCopy.noItems}</p>
                      ) : (
                        items.map((item) => (
                          <article key={`intel-${item.id}`} className="rounded-2xl border border-border/70 bg-background/75 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={resolveSentimentBadgeClass(item.sentiment)}>
                                {renderIntelligenceHeading(lang, item.sentiment)}
                              </Badge>
                              <Badge variant="secondary">{resolveIntelligenceTarget(item, lang)}</Badge>
                              <Badge variant="outline">{intelligenceCopy.importance}: {item.importanceScore}</Badge>
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 block text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                            >
                              {item.title}
                            </a>
                            <p className="mt-2 text-xs text-muted-foreground">{item.source} · {formatDateTime(item.timestamp, lang)}</p>
                            <p className="mt-3 text-sm leading-6 text-foreground/90">{lang === "zh" ? item.contentSummary.zh : item.contentSummary.en}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.clusterId ? (
                                <Link href={assetEventPath(lang, item.clusterId)} className="text-xs font-medium text-primary hover:underline">
                                  {intelligenceCopy.openEvent}
                                </Link>
                              ) : null}
                              {item.targetType === "asset" ? (
                                <Link href={assetInstrumentPath(lang, "crypto", item.targetId)} className="text-xs font-medium text-primary hover:underline">
                                  {intelligenceCopy.openInstrument}
                                </Link>
                              ) : null}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{intelligenceCopy.noItems}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{intelligenceCopy.moverTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{intelligenceCopy.moverSubtitle}</p>
        </CardHeader>
        <CardContent>
          {intelligence && intelligence.movers.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {intelligence.movers.map((mover) => {
                const anchors = groupTimelineAnchors(intelligence.chartAnchors, mover.assetCode);
                return (
                  <article key={`mover-${mover.assetCode}`} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">{lang === "zh" ? mover.assetLabelZh : mover.assetLabelEn}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{mover.assetCode} · {formatDate(mover.reportDate, lang)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${getChangeTextClass(lang, mover.change24hPct)}`}>{formatSignedPercent(mover.change24hPct)}</p>
                        <p className="text-xs text-muted-foreground">{formatCompactCurrency(mover.quoteVolume24hUsdt, lang)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{intelligenceCopy.mainCause}</p>
                      {mover.primaryCause ? (
                        <>
                          <p className="mt-2 text-sm font-semibold text-foreground">{mover.primaryCause.title}</p>
                          <p className="mt-2 text-sm leading-6 text-foreground/90">{lang === "zh" ? mover.primaryCause.contentSummary.zh : mover.primaryCause.contentSummary.en}</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">{intelligenceCopy.noItems}</p>
                      )}
                    </div>

                    {mover.supportingItems.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{intelligenceCopy.supporting}</p>
                        {mover.supportingItems.map((item) => (
                          <div key={`support-${mover.assetCode}-${item.id}`} className="rounded-xl border border-border/60 bg-background/60 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={resolveSentimentBadgeClass(item.sentiment)}>{renderIntelligenceHeading(lang, item.sentiment)}</Badge>
                              <Badge variant="outline">{intelligenceCopy.importance}: {item.importanceScore}</Badge>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{item.source} · {formatDateTime(item.timestamp, lang)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {anchors.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{intelligenceCopy.timeline}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {anchors.map((anchor) => (
                            <Link
                              key={`anchor-${mover.assetCode}-${anchor.clusterId}-${anchor.reportDate}`}
                              href={`${assetInstrumentPath(lang, "crypto", mover.assetCode)}?date=${encodeURIComponent(anchor.reportDate)}`}
                              className="inline-flex items-center rounded-full border border-border/70 bg-background/65 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              {formatDate(anchor.reportDate, lang)} · {anchor.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{intelligenceCopy.noMovers}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("crypto.focusCoverageTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {focusItems.every((item) => (props.coinNewsByCode[item.code] ?? []).length === 0) ? (
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{t("crypto.noFocusCoverage")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
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
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{t("crypto.noMarketNews")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {props.clusters.map((cluster) => (
                <article key={`cluster-${cluster.clusterId}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t("crypto.clusterImpact", { impact: cluster.marketImpact })}</Badge>
                    <Badge variant="secondary">{t("crypto.clusterSources", { count: cluster.sourceCount })}</Badge>
                    <Badge variant="outline">{t("crypto.signalLabel")}: {cluster.importanceScore}</Badge>
                    <Badge variant="outline">{renderStance(cluster.stance, t)}</Badge>
                    {cluster.associationScore !== null ? (
                      <Badge variant="secondary">{t("crypto.associationScoreLabel")}: {cluster.associationScore}</Badge>
                    ) : null}
                  </div>
                  <Link
                    href={assetEventPath(lang, cluster.clusterId)}
                    className="mt-3 block text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                  >
                    {cluster.label}
                  </Link>
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
