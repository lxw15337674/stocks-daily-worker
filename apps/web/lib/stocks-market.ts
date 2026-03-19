import useSWR from "swr";

import {
  buildMarketPageSearch,
  getTodayMarketDate,
  isTodayMarketDate,
  loadHomeArchivedMarketPulse as loadHomeArchivedMarketPulseCore,
  loadHomeLiveMarketPulse as loadHomeLiveMarketPulseCore,
  loadMarketPageData as loadMarketPageDataCore,
  normalizeMarketSummaryDate,
  parseMarketIndexKeys,
  resolveMarketIndexRange,
  type MarketPageQuery,
  type MarketServerDeps
} from "./stocks-market-core";
import {
  fetchStockIndicesHistory,
  fetchStockIndicesLatest,
  fetchStockIndicesFinalSnapshotByDate,
  fetchStockIndicesFinalSummaryByDate,
  fetchStockIndicesIntradaySummaryLatest
} from "./api";

const defaultDeps: MarketServerDeps = {
  fetchLatest: fetchStockIndicesLatest,
  fetchSnapshotByDate: fetchStockIndicesFinalSnapshotByDate,
  fetchHistory: fetchStockIndicesHistory,
  fetchLatestIntradaySummaries: fetchStockIndicesIntradaySummaryLatest,
  fetchFinalSummariesByDate: fetchStockIndicesFinalSummaryByDate
};

export {
  buildMarketPageSearch,
  getTodayMarketDate,
  isTodayMarketDate,
  normalizeMarketSummaryDate,
  parseMarketIndexKeys,
  resolveMarketIndexRange,
  type MarketPageQuery,
  type MarketServerDeps
} from "./stocks-market-core";

export async function loadMarketPageData(query: MarketPageQuery) {
  return loadMarketPageDataCore(query, defaultDeps);
}

export async function loadHomeLiveMarketPulse(todayDate: string) {
  return loadHomeLiveMarketPulseCore(todayDate, defaultDeps);
}

export async function loadHomeArchivedMarketPulse(date: string) {
  return loadHomeArchivedMarketPulseCore(date, defaultDeps);
}

export function useMarketPageData(query: MarketPageQuery) {
  const range = query.range ?? "";
  const indexKeys = query.indexKeys ?? "";
  const summaryDate = query.summaryDate ?? "";
  const shouldRefresh = summaryDate.length === 0 || isTodayMarketDate(summaryDate);
  return useSWR(["stocks-market-page-data", range, indexKeys, summaryDate], () => loadMarketPageData(query), {
    refreshInterval: shouldRefresh ? 10_000 : 0
  });
}

export function useHomeLiveMarketPulse(todayDate: string) {
  return useSWR(["stocks-home-market-pulse-live", todayDate], () => loadHomeLiveMarketPulse(todayDate), {
    refreshInterval: 10_000
  });
}

export function useHomeArchivedMarketPulse(date: string | null) {
  return useSWR(date ? ["stocks-home-market-pulse-archive", date] : null, () => loadHomeArchivedMarketPulse(date ?? ""));
}
