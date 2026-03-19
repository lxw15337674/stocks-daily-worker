import type { MarketIndexLiveItem } from "@china-stocks/contracts";

import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { getFixedT, type Language } from "@/lib/i18n";

import {
  formatMarketRangePct,
  formatMarketTradingMetrics,
  formatMarketVolume
} from "./market-utils";

type MarketTradingMetricsProps = {
  item: MarketIndexLiveItem;
  lang: Language;
};

function MetricCell(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 py-1">
      <p className="font-normal tracking-wide text-muted-foreground">{label}</p>
      <p className="text-right leading-4 font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function MarketTradingMetrics(props: MarketTradingMetricsProps) {
  const { item, lang } = props;
  const t = getFixedT(lang, "stocks", "market");
  const metrics = formatMarketTradingMetrics(item, lang);

  return (
    <CardContent className="flex flex-col gap-2 ">
      <div className="flex items-center justify-between">
        <p className="font-medium uppercase tracking-wide text-muted-foreground">{t("metricsLabel")}</p>
        <Badge variant="outline">{t("latestLabel")}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <MetricCell label={t("highLabel")} value={metrics.high} />
        <MetricCell label={t("openLabel")} value={metrics.open} />
        <MetricCell label={t("week52HighLabel")} value={metrics.fiftyTwoWeekHigh} />
        <MetricCell label={t("lowLabel")} value={metrics.low} />
        <MetricCell label={t("prevCloseLabel")} value={metrics.previousClose} />
        <MetricCell label={t("week52LowLabel")} value={metrics.fiftyTwoWeekLow} />
        <MetricCell label={t("volumeLabel")} value={formatMarketVolume(item.dayVolume, lang)} />
        <MetricCell label={t("rangeLabel")} value={formatMarketRangePct(item.dayRangePct)} />
      </div>
    </CardContent>
  );
}
