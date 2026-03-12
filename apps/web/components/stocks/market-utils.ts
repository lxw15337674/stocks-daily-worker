import type { MarketAiSummary, MarketIndexLatestResponse, MarketIndexLiveItem, MarketRegion } from "@china-stocks/contracts";
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

export function getMarketChangeTextClass(region: MarketRegion, value: number | null): string {
  if (value === null || value === 0) {
    return "text-muted-foreground";
  }

  if (region === "us") {
    return value > 0 ? "text-emerald-400" : "text-red-400";
  }

  return value > 0 ? "text-red-400" : "text-emerald-400";
}

export function getMarketChangePanelClass(region: MarketRegion, value: number | null): string {
  if (value === null || value === 0) {
    return "border-border/70 bg-background/50 text-muted-foreground";
  }

  if (region === "us") {
    return value > 0
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : "border-red-500/30 bg-red-500/10 text-red-200";
  }

  return value > 0
    ? "border-red-500/30 bg-red-500/10 text-red-200"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

export function pickPrimaryMarketItem(items: MarketIndexLiveItem[], primaryIndexKey: string): MarketIndexLiveItem | null {
  return items.find((item) => item.indexKey === primaryIndexKey) ?? items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

export function hasMarketContent(
  latest: MarketIndexLatestResponse | null,
  summary: MarketAiSummary | null
): boolean {
  if (summary) {
    return true;
  }

  return Boolean(
    latest?.regions.some((region) =>
      region.items.some((item) => item.price !== null || item.changePct !== null || item.quoteTimestamp !== null)
    )
  );
}
