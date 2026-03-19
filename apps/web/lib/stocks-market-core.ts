import type {
  MarketAiSummary,
  MarketIndexArchiveResponse,
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
  fetchSnapshotByDate: (date: string) => Promise<MarketIndexArchiveResponse | null>;
  fetchHistory: (indexKeys: string[], range: MarketIndexRange) => Promise<MarketIndexHistoryResponse | null>;
  fetchLatestIntradaySummaries: () => Promise<MarketAiSummary[]>;
  fetchFinalSummariesByDate: (date: string) => Promise<MarketAiSummary[]>;
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

export function getTodayMarketDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function isTodayMarketDate(value: string | undefined): boolean {
  const normalized = normalizeMarketSummaryDate(value);
  return normalized !== null && normalized === getTodayMarketDate();
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
  const useArchivedSnapshot = requestedSummaryDate !== null && !isTodayMarketDate(requestedSummaryDate);
  const snapshotVariant: "live" | "archive" = useArchivedSnapshot ? "archive" : "live";

  const [liveLatest, archivedLatest, history, summary] = await Promise.all([
    useArchivedSnapshot ? Promise.resolve(null) : deps.fetchLatest(),
    useArchivedSnapshot && requestedSummaryDate ? deps.fetchSnapshotByDate(requestedSummaryDate) : Promise.resolve(null),
    deps.fetchHistory(selectedIndexKeys, initialRange),
    useArchivedSnapshot && requestedSummaryDate
      ? deps.fetchFinalSummariesByDate(requestedSummaryDate)
      : deps.fetchLatestIntradaySummaries()
  ]);

  return {
    initialRange,
    latest: archivedLatest ?? liveLatest,
    history,
    summary,
    requestedSummaryDate,
    snapshotVariant,
    selectedIndexKeys
  };
}

export async function loadHomeLiveMarketPulse(todayDate: string, deps: MarketServerDeps) {
  const [latest, summaries] = await Promise.all([deps.fetchLatest(), deps.fetchLatestIntradaySummaries()]);
  return {
    latest,
    summaries: summaries.filter((item) => item.summaryDate === todayDate)
  };
}

export async function loadHomeArchivedMarketPulse(date: string, deps: MarketServerDeps) {
  const [latest, summaries] = await Promise.all([deps.fetchSnapshotByDate(date), deps.fetchFinalSummariesByDate(date)]);
  return { latest, summaries };
}
