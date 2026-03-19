import Link from "next/link";
import type {
  MarketAiSummary,
  MarketIndexArchiveResponse,
  MarketIndexLatestResponse,
  MarketIndexLiveItem,
  MarketRegion
} from "@china-stocks/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getFixedT, type Language } from "@/lib/i18n";
import { MarketTradingMetrics } from "./market-trading-metrics";
import {
  formatMarketMove,
  formatMarketPrice,
  formatMarketTimestamp,
  getMarketChangePanelClass,
  hasMarketContent,
  pickPrimaryMarketItem
} from "./market-utils";

type MarketStatusGridProps = {
  lang: Language;
  latest: MarketIndexLatestResponse | MarketIndexArchiveResponse | null;
  summaries?: MarketAiSummary[] | null;
  variant?: "live" | "archive";
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
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

type MarketIndexPanelCardProps = {
  item: MarketIndexLiveItem;
  lang: Language;
  badgeLabel: string;
};

function MarketIndexPanelCard(props: MarketIndexPanelCardProps) {
  const { item, lang, badgeLabel } = props;
  const t = getFixedT(lang, "stocks", "market");

  return (
    <Card size="sm" className={getMarketChangePanelClass(lang, item.region, item.changePct)}>
      <CardContent className="px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium leading-4 text-foreground">
                {lang === "zh" ? item.nameZh : item.nameEn}
              </p>
              <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                {badgeLabel}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] leading-4 opacity-80">{item.symbol}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-semibold leading-none">
              {formatMarketMove(item.changePct)}
            </p>
            <p className="mt-0.5 text-sm leading-4 opacity-80">
              {formatMarketPrice(item.price, item.currency, lang)}
            </p>
          </div>
        </div>
        <div className="mt-2">
          <MarketTradingMetrics item={item} lang={lang} />
        </div>
        <p className="mt-1.5 text-[11px] leading-4 opacity-80">
          {t("updatedAtLabel")}: {formatMarketTimestamp(item.quoteTimestamp, lang)}
        </p>
      </CardContent>
    </Card>
  );
}

export function MarketStatusGrid(props: MarketStatusGridProps) {
  const { lang, latest, summaries = [], variant = "live", title, description, actionHref, actionLabel } = props;
  const t = getFixedT(lang, "stocks", "market");
  const normalizedSummaries = summaries ?? [];
  const hasContent = hasMarketContent(latest, normalizedSummaries);
  const regionBadgeLabel = variant === "archive" ? t("archiveBadge") : t("liveBadge");
  const itemBadgeLabel = variant === "archive" ? t("archiveBadge") : t("latestLabel");
  const summaryByRegion = new Map(normalizedSummaries.map((item) => [item.region, item]));

  const grid = (
    <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
      {(latest?.regions ?? []).map((regionGroup) => {
        const primary = pickPrimaryMarketItem(regionGroup.items, regionGroup.primaryIndexKey);
        const orderedItems = primary
          ? [primary, ...regionGroup.items.filter((item) => item.indexKey !== primary.indexKey)]
          : regionGroup.items;
        const regionSummary = summaryByRegion.get(regionGroup.region) ?? null;
        const regionSummaryText =
          (lang === "zh" ? regionSummary?.summaryZh : regionSummary?.summaryEn) ??
          regionSummary?.summaryZh ??
          regionSummary?.summaryEn ??
          null;

        return (
          <Card key={regionGroup.region} className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{resolveRegionLabel(lang, regionGroup.region)}</CardTitle>
                <Badge variant="outline">{regionBadgeLabel}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {regionSummaryText ? (
                <Card size="sm" className="bg-background/45">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {variant === "archive" ? t("finalSummaryLabel") : t("intradaySummaryLabel")}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-foreground/90">{regionSummaryText}</p>
                    {regionSummary?.sourceQuoteTimestamp ? (
                      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                        {t("updatedAtLabel")}: {formatMarketTimestamp(regionSummary.sourceQuoteTimestamp, lang)}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
              {orderedItems.length === 0 ? (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-6">
                  <EmptyHeader>
                    <EmptyTitle>{t("unavailable")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-2">
                  {orderedItems.map((item, index) => (
                    <MarketIndexPanelCard
                      key={item.indexKey}
                      item={item}
                      lang={lang}
                      badgeLabel={index === 0 && primary ? t("primaryLabel") : itemBadgeLabel}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  if (!title && !description && !actionHref && normalizedSummaries.length === 0) {
    if (!hasContent) {
      return null;
    }
    return grid;
  }

  return (
    <Card>
      <CardHeader className="pb-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            {title ? <CardTitle className="text-2xl">{title}</CardTitle> : null}
            {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
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
      <CardContent className="space-y-3">
        {!hasContent ? (
          <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
            <EmptyHeader>
              <EmptyTitle>{t("unavailable")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : null}
        {hasContent ? grid : null}
      </CardContent>
    </Card>
  );
}
