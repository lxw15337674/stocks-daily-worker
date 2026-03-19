import Link from "next/link";
import type { MarketAiSummary, MarketIndexLatestResponse, MarketRegion } from "@china-stocks/contracts";

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
  const { lang, latest, summary = null, title, description, actionHref, actionLabel } = props;
  const t = getFixedT(lang, "stocks", "market");
  const commonT = getFixedT(lang, "common");

  if (!hasMarketContent(latest, summary)) {
    return null;
  }

  const summaryText =
    (lang === "zh" ? summary?.summaryZh : summary?.summaryEn) ?? summary?.summaryZh ?? summary?.summaryEn ?? null;

  const grid = (
    <div className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
      {(latest?.regions ?? []).map((regionGroup) => {
        const primary = pickPrimaryMarketItem(regionGroup.items, regionGroup.primaryIndexKey);
        const secondary = regionGroup.items.filter((item) => item.indexKey !== primary?.indexKey);

        return (
          <Card key={regionGroup.region} className="h-full">
            <CardHeader className="pb-2.5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{resolveRegionLabel(lang, regionGroup.region)}</CardTitle>
                <Badge variant="outline">{t("liveBadge")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {primary ? (
                <Card size="sm" className={getMarketChangePanelClass(lang, primary.region, primary.changePct)}>
                  <CardContent className="p-2">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium leading-5 text-foreground">
                            {lang === "zh" ? primary.nameZh : primary.nameEn}
                          </p>
                          <Badge variant="secondary">{t("primaryLabel")}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs opacity-80">{primary.symbol}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-semibold leading-none">
                          {formatMarketMove(primary.changePct)}
                        </p>
                        <p className="mt-0.5 text-sm opacity-80">
                          {formatMarketPrice(primary.price, primary.currency, lang)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <MarketTradingMetrics item={primary} lang={lang} />
                    </div>
                    <p className="mt-2 text-xs leading-5 opacity-80">
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
                <div className="space-y-1.5">
                  {secondary.map((item) => (
                    <Card key={item.indexKey} size="sm" className="bg-background/45">
                      <CardContent className="flex flex-col gap-1.5 px-2.5 py-2.5">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-5 text-foreground">
                              {lang === "zh" ? item.nameZh : item.nameEn}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.symbol}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="whitespace-nowrap text-sm font-medium text-foreground">
                              {formatMarketPrice(item.price, item.currency, lang)}
                            </p>
                            <p className={`mt-0.5 text-xs font-medium ${getMarketChangeTextClass(lang, item.region, item.changePct)}`}>
                              {formatMarketMove(item.changePct)}
                            </p>
                          </div>
                        </div>
                        <MarketTradingMetrics item={item} lang={lang} />
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
        {summary || summaryText ? (
          <Card size="sm" className="bg-background/45">
            <CardContent className="p-3">
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
              <p className="mt-2 text-sm leading-6 text-foreground/90">
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
