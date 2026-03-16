import Link from "next/link";
import type { MarketAiSummary, MarketIndexLatestResponse, MarketIndexLiveItem, MarketRegion } from "@china-stocks/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getFixedT, type Language } from "@/lib/i18n";
import {
  formatMarketMove,
  formatMarketPrice,
  formatMarketRangePct,
  formatMarketTradingMetrics,
  formatMarketTimestamp,
  formatMarketVolume,
  getMarketChangePanelClass,
  getMarketChangeTextClass,
  hasMarketContent,
  pickPrimaryMarketItem
} from "./market-utils";

type MarketStatusGridProps = {
  lang: Language;
  latest: MarketIndexLatestResponse | null;
  summary?: MarketAiSummary | null;
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  compact?: boolean;
};

function resolveRegionLabel(lang: Language, region: MarketRegion): string {
  const t = getFixedT(lang, "stocks", "market");
  if (region === "cn") {
    return t("regionCn");
  }
  if (region === "hk") {
    return t("regionHk");
  }
  return t("regionUs");
}

export function MarketStatusGrid(props: MarketStatusGridProps) {
  const { lang, latest, summary = null, title, description, actionHref, actionLabel, compact = false } = props;
  const t = getFixedT(lang, "stocks", "market");
  const commonT = getFixedT(lang, "common");

  function renderMetricCell(label: string, value: string, compactView = false) {
    return (
        <div className={compactView ? "flex items-center justify-between gap-2 py-1" : "flex flex-col gap-1 px-2.5 py-2"}>
          <p className={compactView ? "font-normal tracking-wide text-muted-foreground" : " font-normal uppercase tracking-wide text-muted-foreground"}>
            {label}
          </p>
          <p className={compactView ? "whitespace-nowrap  leading-4 font-semibold text-foreground" : "leading-5 font-semibold text-foreground"}>
            {value}
          </p>
        </div>
    );
  }

  function renderTradingMetrics(item: MarketIndexLiveItem, compactView = false) {
    const metrics = formatMarketTradingMetrics(item, lang);
    const compactMetricItems: Array<{ label: string; value: string }> = [
      { label: t("highLabel"), value: metrics.high },
      { label: t("openLabel"), value: metrics.open },
      { label: t("week52HighLabel"), value: metrics.fiftyTwoWeekHigh },
      { label: t("lowLabel"), value: metrics.low },
      { label: t("prevCloseLabel"), value: metrics.previousClose },
      { label: t("week52LowLabel"), value: metrics.fiftyTwoWeekLow },
      { label: t("volumeLabel"), value: formatMarketVolume(item.dayVolume, lang) },
      { label: t("rangeLabel"), value: formatMarketRangePct(item.dayRangePct) }
    ];

    return (
        <CardContent className={compactView ? "flex flex-col gap-2 p-2.5" : "flex flex-col gap-2.5 p-3"}>
          <div className="flex items-center justify-between">
            <p className=" font-medium uppercase tracking-wide text-muted-foreground">{t("metricsLabel")}</p>
            <Badge variant="outline" className="">
              {t("latestLabel")}
            </Badge>
          </div>

          {compactView ? (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {compactMetricItems.map((metricItem) => (
                <div key={`${item.indexKey}-${metricItem.label}`}>{renderMetricCell(metricItem.label, metricItem.value, true)}</div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {renderMetricCell(t("highLabel"), metrics.high)}
                {renderMetricCell(t("openLabel"), metrics.open)}
                {renderMetricCell(t("week52HighLabel"), metrics.fiftyTwoWeekHigh)}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {renderMetricCell(t("lowLabel"), metrics.low)}
                {renderMetricCell(t("prevCloseLabel"), metrics.previousClose)}
                {renderMetricCell(t("week52LowLabel"), metrics.fiftyTwoWeekLow)}
              </div>

              <div className="h-px bg-border/70" />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {renderMetricCell(t("volumeLabel"), formatMarketVolume(item.dayVolume, lang))}
                {renderMetricCell(t("rangeLabel"), formatMarketRangePct(item.dayRangePct))}
              </div>
            </>
          )}
        </CardContent>
    );
  }

  if (!hasMarketContent(latest, summary)) {
    return null;
  }

  const summaryText =
    (lang === "zh" ? summary?.summaryZh : summary?.summaryEn) ?? summary?.summaryZh ?? summary?.summaryEn ?? null;

  const grid = (
    <div className={compact ? "grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3" : "grid gap-4 lg:grid-cols-3"}>
      {(latest?.regions ?? []).map((regionGroup) => {
        const primary = pickPrimaryMarketItem(regionGroup.items, regionGroup.primaryIndexKey);
        const secondary = regionGroup.items.filter((item) => item.indexKey !== primary?.indexKey);

        return (
          <Card key={regionGroup.region} className={compact ? "h-full" : undefined}>
            <CardHeader className={compact ? "pb-2.5" : "pb-3"}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{resolveRegionLabel(lang, regionGroup.region)}</CardTitle>
                <Badge variant="outline">{t("liveBadge")}</Badge>
              </div>
            </CardHeader>
            <CardContent className={compact ? "space-y-3" : "space-y-4"}>
              {primary ? (
                <Card size="sm" className={getMarketChangePanelClass(lang, primary.region, primary.changePct)}>
                  <CardContent className={compact ? "p-3" : "p-4"}>
                    <div className={compact ? "flex items-start justify-between gap-2.5" : "flex items-start justify-between gap-3"}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium leading-5 text-foreground">
                            {lang === "zh" ? primary.nameZh : primary.nameEn}
                          </p>
                          <Badge variant="secondary">{t("primaryLabel")}</Badge>
                        </div>
                        <p className={compact ? "mt-0.5 text-xs opacity-80" : "mt-1 text-xs opacity-80"}>{primary.symbol}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-semibold leading-none">
                          {formatMarketMove(primary.changePct)}
                        </p>
                        <p className={compact ? "mt-0.5 text-sm opacity-80" : "mt-1 text-sm opacity-80"}>
                          {formatMarketPrice(primary.price, primary.currency, lang)}
                        </p>
                      </div>
                    </div>
                    <div className={compact ? "mt-2.5" : "mt-3"}>{renderTradingMetrics(primary, compact)}</div>
                    <p className={compact ? "mt-2 text-xs leading-5 opacity-80" : "mt-3 text-xs leading-5 opacity-80"}>
                      {t("updatedAtLabel")}: {formatMarketTimestamp(primary.quoteTimestamp, lang)}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-6">
                  <EmptyHeader>
                    <EmptyTitle>{t("unavailable")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}

              {secondary.length > 0 ? (
                <div className={compact ? "space-y-1.5" : "space-y-2"}>
                  {secondary.map((item) => (
                    <Card key={item.indexKey} size="sm" className="bg-background/45">
                      <CardContent className={compact ? "flex flex-col gap-1.5 px-2.5 py-2.5" : "flex flex-col gap-2 px-3 py-3"}>
                        <div className={compact ? "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2" : "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-5 text-foreground">
                              {lang === "zh" ? item.nameZh : item.nameEn}
                            </p>
                            <p className={compact ? "mt-0.5 text-xs text-muted-foreground" : "mt-1 text-xs text-muted-foreground"}>
                              {item.symbol}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="whitespace-nowrap text-sm font-medium text-foreground">
                              {formatMarketPrice(item.price, item.currency, lang)}
                            </p>
                            <p className={`${compact ? "mt-0.5" : "mt-1"} text-xs font-medium ${getMarketChangeTextClass(lang, item.region, item.changePct)}`}>
                              {formatMarketMove(item.changePct)}
                            </p>
                          </div>
                        </div>
                        {renderTradingMetrics(item, true)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  if (!title && !description && !actionHref && !summary) {
    return grid;
  }

  return (
    <Card>
      <CardHeader className={compact ? "pb-2.5" : "pb-4"}>
        <div className={compact ? "flex flex-wrap items-start justify-between gap-3" : "flex flex-wrap items-start justify-between gap-4"}>
          <div className={compact ? "space-y-1.5" : "space-y-2"}>
            {title ? <CardTitle className="text-2xl">{title}</CardTitle> : null}
            {description ? <p className={compact ? "max-w-3xl text-sm leading-6 text-muted-foreground" : "max-w-3xl text-sm leading-7 text-muted-foreground"}>{description}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {latest?.updatedAt ? <Badge variant="outline">{formatMarketTimestamp(latest.updatedAt, lang)}</Badge> : null}
            {actionHref && actionLabel ? (
              <Button asChild variant="outline" size="sm">
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? "space-y-3" : "space-y-4"}>
        {summary || summaryText ? (
          <Card size="sm" className="bg-background/45">
            <CardContent className={compact ? "p-3" : "p-4"}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{t("summaryTitle")}</p>
                {summary ? (
                  <span className="text-xs text-muted-foreground">
                    {commonT("reportDate")}: {summary.summaryDate}
                    {" · "}
                    {commonT("generatedAt")}: {formatMarketTimestamp(summary.createdAt, lang)}
                  </span>
                ) : null}
              </div>
              <p className={compact ? "mt-2 text-sm leading-6 text-foreground/90" : "mt-3 text-sm leading-7 text-foreground/90"}>
                {summaryText ?? t("noSummary")}
              </p>
            </CardContent>
          </Card>
        ) : null}
        {grid}
      </CardContent>
    </Card>
  );
}
