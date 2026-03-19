import type { MarketIndexLiveItem } from "@china-stocks/contracts";

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
    <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
      <p className="truncate text-[11px] font-normal leading-4 tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm leading-4 font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function MarketTradingMetrics(props: MarketTradingMetricsProps) {
  const { item, lang } = props;
  const t = getFixedT(lang, "stocks", "market");
  const metrics = formatMarketTradingMetrics(item, lang);

  return (
    <CardContent className="px-0">
      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
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
