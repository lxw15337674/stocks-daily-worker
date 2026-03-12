import type { MarketAiSummary, MarketIndexLatestResponse, MarketIndexLiveItem, MarketRegion } from "@china-stocks/contracts";
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
