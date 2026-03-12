import {
  buildMarketPageSearch,
  loadHomeMarketPulse as loadHomeMarketPulseCore,
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
  fetchStockIndicesSummaryByDate,
  fetchStockIndicesSummaryLatest
} from "./api";

const defaultDeps: MarketServerDeps = {
  fetchLatest: fetchStockIndicesLatest,
  fetchHistory: fetchStockIndicesHistory,
  fetchLatestSummary: fetchStockIndicesSummaryLatest,
  fetchSummaryByDate: fetchStockIndicesSummaryByDate
};

export {
  buildMarketPageSearch,
  normalizeMarketSummaryDate,
  parseMarketIndexKeys,
  resolveMarketIndexRange,
  type MarketPageQuery,
  type MarketServerDeps
} from "./stocks-market-core";

export async function loadMarketPageData(query: MarketPageQuery) {
  return loadMarketPageDataCore(query, defaultDeps);
}

export async function loadHomeMarketPulse() {
  return loadHomeMarketPulseCore(defaultDeps);
}
