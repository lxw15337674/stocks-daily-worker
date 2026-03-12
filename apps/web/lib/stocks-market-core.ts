import type {
  MarketAiSummary,
  MarketIndexHistoryResponse,
  MarketIndexKey,
  MarketIndexLatestResponse,
  MarketIndexRange
} from "@china-stocks/contracts";
import { MARKET_INDEX_KEYS } from "@china-stocks/contracts";

export const DEFAULT_MARKET_INDEX_KEYS: MarketIndexKey[] = ["cn_sse", "hk_hsi", "us_sp500"];

export type MarketPageQuery = {
  range?: string;
  indexKeys?: string;
  summaryDate?: string;
};

export type MarketServerDeps = {
  fetchLatest: () => Promise<MarketIndexLatestResponse | null>;
  fetchHistory: (indexKeys: string[], range: MarketIndexRange) => Promise<MarketIndexHistoryResponse | null>;
  fetchLatestSummary: () => Promise<MarketAiSummary | null>;
  fetchSummaryByDate: (date: string) => Promise<MarketAiSummary | null>;
};

const MARKET_INDEX_KEY_SET = new Set<string>(MARKET_INDEX_KEYS);

export function resolveMarketIndexRange(value: string | undefined): MarketIndexRange {
  if (value === "1m" || value === "3m" || value === "1y") {
    return value;
  }
  return "3m";
}

export function parseMarketIndexKeys(value: string | undefined): MarketIndexKey[] {
  const normalized = Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is MarketIndexKey => MARKET_INDEX_KEY_SET.has(item))
    )
  );

  return normalized.length > 0 ? normalized : [...DEFAULT_MARKET_INDEX_KEYS];
}

export function normalizeMarketSummaryDate(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export function buildMarketPageSearch(input: {
  range: MarketIndexRange;
  indexKeys: string[];
  summaryDate?: string | null;
}): string {
  const query = new URLSearchParams({
    range: input.range
  });

  const normalizedKeys = Array.from(
    new Set(
      input.indexKeys
        .map((item) => item.trim())
        .filter((item): item is MarketIndexKey => MARKET_INDEX_KEY_SET.has(item))
    )
  );
  if (normalizedKeys.length > 0) {
    query.set("indexKeys", normalizedKeys.join(","));
  }

  const summaryDate = normalizeMarketSummaryDate(input.summaryDate ?? undefined);
  if (summaryDate) {
    query.set("summaryDate", summaryDate);
  }

  return query.toString();
}

export async function loadMarketPageData(query: MarketPageQuery, deps: MarketServerDeps) {
  const initialRange = resolveMarketIndexRange(query.range);
  const selectedIndexKeys = parseMarketIndexKeys(query.indexKeys);
  const requestedSummaryDate = normalizeMarketSummaryDate(query.summaryDate);

  const [latest, history, summary] = await Promise.all([
    deps.fetchLatest(),
    deps.fetchHistory(selectedIndexKeys, initialRange),
    requestedSummaryDate ? deps.fetchSummaryByDate(requestedSummaryDate) : deps.fetchLatestSummary()
  ]);

  return {
    initialRange,
    latest,
    history,
    summary,
    requestedSummaryDate,
    selectedIndexKeys
  };
}

export async function loadHomeMarketPulse(deps: MarketServerDeps) {
  const [latest, summary] = await Promise.all([deps.fetchLatest(), deps.fetchLatestSummary()]);
  return { latest, summary };
}
