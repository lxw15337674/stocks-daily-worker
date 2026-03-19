import type {
  MarketAiSummary,
  MarketIndexArchiveResponse,
  MarketIndexLatestResponse,
  MarketIndexLiveItem,
  MarketRegion
} from "@china-stocks/contracts";
import { getChangePanelClass, getChangeTextClass } from "@/lib/change-color";
import type { Language } from "@/lib/i18n";

export const MARKET_REGION_ORDER: MarketRegion[] = ["cn", "hk", "us"];

export function formatMarketPrice(value: number | null, currency: string | null, lang: Language): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (currency) {
    try {
      return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  return value.toFixed(2);
}

export function formatMarketMove(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatMarketRangePct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(2)}%`;
}

export function formatMarketVolume(value: number | null, lang: Language): string {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "-";
  }

  try {
    return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
      notation: "compact",
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(2)}K`;
    }
    return value.toFixed(0);
  }
}

export function formatMarketMetricValue(value: number | null, lang: Language): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatMarketOhl(
  open: number | null,
  high: number | null,
  low: number | null,
  lang: Language
): { open: string; high: string; low: string } {
  return {
    open: formatMarketMetricValue(open, lang),
    high: formatMarketMetricValue(high, lang),
    low: formatMarketMetricValue(low, lang)
  };
}

export function formatMarketTradingMetrics(
  item: Pick<MarketIndexLiveItem, "dayOpen" | "dayHigh" | "dayLow" | "previousClose" | "fiftyTwoWeekHigh" | "fiftyTwoWeekLow">,
  lang: Language
): {
  open: string;
  high: string;
  low: string;
  previousClose: string;
  fiftyTwoWeekHigh: string;
  fiftyTwoWeekLow: string;
} {
  return {
    open: formatMarketMetricValue(item.dayOpen, lang),
    high: formatMarketMetricValue(item.dayHigh, lang),
    low: formatMarketMetricValue(item.dayLow, lang),
    previousClose: formatMarketMetricValue(item.previousClose, lang),
    fiftyTwoWeekHigh: formatMarketMetricValue(item.fiftyTwoWeekHigh, lang),
    fiftyTwoWeekLow: formatMarketMetricValue(item.fiftyTwoWeekLow, lang)
  };
}

export function formatMarketTimestamp(value: string | null, lang: Language): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    timeZone: lang === "zh" ? "Asia/Shanghai" : "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function getMarketChangeTextClass(lang: Language, _region: MarketRegion, value: number | null): string {
  return getChangeTextClass(lang, value);
}

export function getMarketChangePanelClass(lang: Language, _region: MarketRegion, value: number | null): string {
  return getChangePanelClass(lang, value);
}

export function pickPrimaryMarketItem(items: MarketIndexLiveItem[], primaryIndexKey: string): MarketIndexLiveItem | null {
  return items.find((item) => item.indexKey === primaryIndexKey) ?? items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

export function hasMarketContent(
  latest: MarketIndexLatestResponse | MarketIndexArchiveResponse | null,
  summaries: MarketAiSummary[] | null | undefined
): boolean {
  if ((summaries?.length ?? 0) > 0) {
    return true;
  }

  return Boolean(
    latest?.regions.some((region) =>
      region.items.some((item) => item.price !== null || item.changePct !== null || item.quoteTimestamp !== null)
    )
  );
}
