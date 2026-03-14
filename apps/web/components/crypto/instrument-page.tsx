import Link from "next/link";

import { NewsSectionCard } from "@/components/crypto/news-section-card";
import { CryptoInstrumentDateForm } from "@/components/crypto/instrument-date-form";
import { HeroPanel } from "@/components/platform/hero-panel";
import { MetricCard, MetricGrid } from "@/components/platform/metric-grid";
import { StatusCard } from "@/components/platform/status-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getChangeTextClass } from "@/lib/change-color";
import { fetchCoinDetail, fetchCoinNews, fetchMacroSnapshot } from "@/lib/crypto/api";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/crypto/format";
import { isValidReportDate } from "@/lib/date";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetEventPath } from "@/lib/platform-routes";

type CryptoInstrumentPageProps = {
  lang: Language;
  code: string;
  searchParams: Promise<{ date?: string }>;
};

const ANCHOR_COPY = {
  zh: {
    title: "日期锚点摘要",
    empty: "所选日期暂无事件锚点",
    openEvent: "查看事件详情"
  },
  en: {
    title: "Date Anchor Summary",
    empty: "No event anchors for the selected date",
    openEvent: "Open event detail"
  }
} as const;

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

export async function CryptoInstrumentPageContent(props: CryptoInstrumentPageProps) {
  const { code, lang } = props;
  const t = getFixedT(lang, "common");
  const { date: rawDate } = await props.searchParams;
  const detail = await fetchCoinDetail(code);

  if (!detail) {
    return <StatusCard title={code.toUpperCase()} body={t("noData")} />;
  }

  const requestedDate = rawDate?.trim() ?? "";
  const defaultReportDate = detail.history[0]?.reportDate ?? null;
  const selectedReportDate =
    requestedDate && isValidReportDate(requestedDate)
      ? requestedDate
      : defaultReportDate;

  const [newsItems, macro] = selectedReportDate
    ? await Promise.all([
        fetchCoinNews(code, 8, 72, selectedReportDate),
        fetchMacroSnapshot(selectedReportDate)
      ])
    : [[], null];

  const name = lang === "zh" ? detail.coin.nameZh : detail.coin.nameEn;
  const corePosition = lang === "zh" ? detail.coin.corePositionZh : detail.coin.corePositionEn;
  const anchorCopy = ANCHOR_COPY[lang];
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
            detail.latestSnapshot ? getChangeTextClass(lang, detail.latestSnapshot.change24hPct) : "text-muted-foreground"
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
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{t("crypto.eventTimelineEmpty")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {detail.eventTimeline.map((item) => (
                <article key={`timeline-${item.clusterId}`} className="rounded-md border border-border/70 bg-background/45 p-4">
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

      {selectedReportDate ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{anchorCopy.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {(eventTimelineByDate.get(selectedReportDate) ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{anchorCopy.empty}</p>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {(eventTimelineByDate.get(selectedReportDate) ?? []).map((item) => (
                  <article key={`anchor-${selectedReportDate}-${item.clusterId}`} className="rounded-md border border-border/70 bg-background/45 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{renderStance(item.stance, t)}</Badge>
                      <Badge variant="secondary">{t("crypto.clusterImpact", { impact: item.marketImpact })}</Badge>
                      <Badge variant="outline">{t("crypto.signalLabel")}: {item.importanceScore}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.representative.source} · {formatDateTime(item.representative.publishedAt, lang)}</p>
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
                    <Link href={assetEventPath(lang, item.clusterId)} className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
                      {anchorCopy.openEvent}
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("recentHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.history.length === 0 ? (
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{t("noData")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
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
                        <TableCell className={`text-right font-semibold ${getChangeTextClass(lang, item.change24hPct)}`}>
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

      {selectedReportDate ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("crypto.dateScopedNewsLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CryptoInstrumentDateForm
              value={selectedReportDate}
              label={t("reportDate")}
              submitLabel={t("viewReport")}
              invalidDateError={t("forms.invalidDateError")}
            />
            <p className="text-xs text-muted-foreground">
              {t("reportDate")}: {selectedReportDate}
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
        emptyText={t("crypto.noCoinNews")}
        items={newsItems}
      />
    </main>
  );
}
