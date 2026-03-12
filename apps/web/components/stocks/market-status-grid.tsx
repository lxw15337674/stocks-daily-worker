import Link from "next/link";
import type { MarketAiSummary, MarketIndexLatestResponse, MarketRegion } from "@china-stocks/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getFixedT, type Language } from "@/lib/i18n";
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

  if (!hasMarketContent(latest, summary)) {
    return null;
  }

  const summaryText =
    (lang === "zh" ? summary?.summaryZh : summary?.summaryEn) ?? summary?.summaryZh ?? summary?.summaryEn ?? null;

  const grid = (
    <div className={compact ? "grid gap-4 xl:grid-cols-3" : "grid gap-4 lg:grid-cols-3"}>
      {(latest?.regions ?? []).map((regionGroup) => {
        const primary = pickPrimaryMarketItem(regionGroup.items, regionGroup.primaryIndexKey);
        const secondary = regionGroup.items.filter((item) => item.indexKey !== primary?.indexKey);

        return (
          <Card key={regionGroup.region}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{resolveRegionLabel(lang, regionGroup.region)}</CardTitle>
                <Badge variant="outline">{t("liveBadge")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {primary ? (
                <div className={`rounded-2xl border p-4 ${getMarketChangePanelClass(lang, primary.region, primary.changePct)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{lang === "zh" ? primary.nameZh : primary.nameEn}</p>
                        <Badge variant="secondary">{t("primaryLabel")}</Badge>
                      </div>
                      <p className="mt-1 text-xs opacity-80">{primary.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold">{formatMarketMove(primary.changePct)}</p>
                      <p className="mt-1 text-xs opacity-80">{formatMarketPrice(primary.price, primary.currency, lang)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs opacity-80">
                    {t("updatedAtLabel")}: {formatMarketTimestamp(primary.quoteTimestamp, lang)}
                  </p>
                </div>
              ) : (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-6">
                  <EmptyHeader>
                    <EmptyTitle>{t("unavailable")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}

              {secondary.length > 0 ? (
                <div className="space-y-2">
                  {secondary.map((item) => (
                    <div key={item.indexKey} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{lang === "zh" ? item.nameZh : item.nameEn}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-foreground">{formatMarketPrice(item.price, item.currency, lang)}</p>
                        <p className={`mt-1 text-xs font-medium ${getMarketChangeTextClass(lang, item.region, item.changePct)}`}>
                          {formatMarketMove(item.changePct)}
                        </p>
                      </div>
                    </div>
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
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {title ? <CardTitle className="text-2xl">{title}</CardTitle> : null}
            {description ? <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p> : null}
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
      <CardContent className="space-y-4">
        {summary || summaryText ? (
          <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
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
            <p className="mt-3 text-sm leading-7 text-foreground/90">{summaryText ?? t("noSummary")}</p>
          </div>
        ) : null}
        {grid}
      </CardContent>
    </Card>
  );
}
