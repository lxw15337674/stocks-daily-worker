import useSWR from "swr";

import { clientFetchJson } from "@/lib/client-fetch";
import type {
  LocalizedText,
  MarketAiSummary,
  MarketAiSummaryResponse,
  MarketIndexArchiveResponse,
  MarketIndexHistoryResponse,
  MarketIndexLatestResponse,
  MarketIndexRange,
  ReportListItem,
  ReportListResponse,
  StockDailyReport,
  StockDetailListResponse,
  StockDetailResult,
  StockListItem,
  StockListResponse
} from "@china-stocks/contracts";

export type {
  LocalizedText,
  MarketAiSummary,
  MarketIndexHistoryResponse,
  MarketIndexLatestResponse,
  MarketIndexRange,
  ReportListItem,
  StockDailyReport,
  StockDetailResult,
  StockHistoryPoint,
  StockListItem
} from "@china-stocks/contracts";

export type HomeBriefsResponse = {
  ok: boolean;
  items: {
    stocks: LocalizedText | null;
    crypto: LocalizedText | null;
  };
};

function joinStocksApi(path: string): string {
  return `/api/v1/stocks${path}`;
}

function joinRootApi(path: string): string {
  return `/api/v1${path}`;
}

export async function fetchHomeBriefs(): Promise<HomeBriefsResponse["items"] | null> {
  const result = await clientFetchJson<HomeBriefsResponse>(joinRootApi("/home/briefs"));
  return result.items ?? null;
}

export async function fetchStockReportByDate(date: string): Promise<StockDailyReport | null> {
  const normalized = date?.trim?.() ?? "";
  if (!normalized) {
    return null;
  }

  try {
    return await clientFetchJson<StockDailyReport>(joinStocksApi(`/report-data/${encodeURIComponent(normalized)}`));
  } catch {
    return null;
  }
}

export async function fetchReportList(limit = 60): Promise<ReportListItem[]> {
  try {
    const result = await clientFetchJson<ReportListResponse>(
      joinStocksApi(`/reports?limit=${Math.max(1, Math.min(limit, 200))}`)
    );
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchStockList(): Promise<StockListItem[]> {
  try {
    const result = await clientFetchJson<StockListResponse>(joinStocksApi("/stocks"));
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchStockDetail(symbol: string): Promise<StockDetailResult | null> {
  const normalized = symbol.trim();
  if (!normalized) {
    return null;
  }

  try {
    return await clientFetchJson<StockDetailResult>(joinStocksApi(`/stock/${encodeURIComponent(normalized)}`));
  } catch {
    return null;
  }
}

export async function fetchStockDetails(symbols: string[]): Promise<StockDetailResult[]> {
  const normalized = Array.from(new Set(symbols.map((symbol) => symbol.trim()).filter((symbol) => symbol.length > 0)));
  if (normalized.length === 0) {
    return [];
  }

  try {
    const query = new URLSearchParams({ symbols: normalized.join(",") });
    const result = await clientFetchJson<StockDetailListResponse>(joinStocksApi(`/stocks/details?${query.toString()}`));
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchStockIndicesLatest(): Promise<MarketIndexLatestResponse | null> {
  try {
    return await clientFetchJson<MarketIndexLatestResponse>(joinStocksApi("/indices/latest"));
  } catch {
    return null;
  }
}

export async function fetchStockIndicesSnapshotByDate(date: string): Promise<MarketIndexArchiveResponse | null> {
  const normalized = date.trim();
  if (!normalized) {
    return null;
  }

  try {
    return await clientFetchJson<MarketIndexArchiveResponse>(joinStocksApi(`/indices/snapshot/${encodeURIComponent(normalized)}`));
  } catch {
    return null;
  }
}

export async function fetchStockIndicesFinalSnapshotByDate(date: string): Promise<MarketIndexArchiveResponse | null> {
  const normalized = date.trim();
  if (!normalized) {
    return null;
  }

  try {
    return await clientFetchJson<MarketIndexArchiveResponse>(
      joinStocksApi(`/indices/snapshot/final/${encodeURIComponent(normalized)}`)
    );
  } catch {
    return null;
  }
}

export async function fetchStockIndicesHistory(
  indexKeys: string[],
  range: MarketIndexRange
): Promise<MarketIndexHistoryResponse | null> {
  const query = new URLSearchParams({ range });
  const normalized = Array.from(new Set(indexKeys.map((item) => item.trim()).filter((item) => item.length > 0)));
  if (normalized.length > 0) {
    query.set("indexKeys", normalized.join(","));
  }

  try {
    return await clientFetchJson<MarketIndexHistoryResponse>(joinStocksApi(`/indices/history?${query.toString()}`));
  } catch {
    return null;
  }
}

export async function fetchStockIndicesSummaryLatest(): Promise<MarketAiSummary[]> {
  try {
    const result = await clientFetchJson<MarketAiSummaryResponse>(joinStocksApi("/indices/summary/latest"));
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchStockIndicesSummaryByDate(date: string): Promise<MarketAiSummary[]> {
  const normalized = date.trim();
  if (!normalized) {
    return [];
  }

  try {
    const result = await clientFetchJson<MarketAiSummaryResponse>(
      joinStocksApi(`/indices/summary/${encodeURIComponent(normalized)}`)
    );
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchStockIndicesIntradaySummaryLatest(): Promise<MarketAiSummary[]> {
  try {
    const result = await clientFetchJson<MarketAiSummaryResponse>(joinStocksApi("/indices/summary/intraday/latest"));
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchStockIndicesFinalSummaryLatest(): Promise<MarketAiSummary[]> {
  try {
    const result = await clientFetchJson<MarketAiSummaryResponse>(joinStocksApi("/indices/summary/final/latest"));
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchStockIndicesFinalSummaryByDate(date: string): Promise<MarketAiSummary[]> {
  const normalized = date.trim();
  if (!normalized) {
    return [];
  }

  try {
    const result = await clientFetchJson<MarketAiSummaryResponse>(
      joinStocksApi(`/indices/summary/final/${encodeURIComponent(normalized)}`)
    );
    return result.items ?? [];
  } catch {
    return [];
  }
}

export function useHomeBriefs() {
  return useSWR<HomeBriefsResponse["items"] | null>("home-briefs", fetchHomeBriefs);
}

export function useStockReportByDate(date: string | null) {
  return useSWR<StockDailyReport | null>(date ? ["stocks-report-by-date", date] : null, () => fetchStockReportByDate(date ?? ""));
}

export function useReportList(limit = 60) {
  return useSWR<ReportListItem[]>(["stocks-report-list", limit], () => fetchReportList(limit));
}

export function useStockList() {
  return useSWR<StockListItem[]>("stocks-list", fetchStockList);
}

export function useStockDetail(symbol: string | null) {
  return useSWR<StockDetailResult | null>(symbol ? ["stock-detail", symbol] : null, () => fetchStockDetail(symbol ?? ""));
}

export function useStockDetails(symbols: string[]) {
  const normalized = Array.from(new Set(symbols.map((item) => item.trim()).filter((item) => item.length > 0)));
  const key = normalized.length > 0 ? ["stock-details", normalized.join(",")] : null;
  return useSWR<StockDetailResult[]>(key, () => fetchStockDetails(normalized));
}

export function useStockIndicesLatest() {
  return useSWR<MarketIndexLatestResponse | null>("stock-indices-latest", fetchStockIndicesLatest);
}

export function useStockIndicesHistory(indexKeys: string[], range: MarketIndexRange) {
  const normalized = Array.from(new Set(indexKeys.map((item) => item.trim()).filter((item) => item.length > 0)));
  const key = ["stock-indices-history", range, normalized.join(",")];
  return useSWR<MarketIndexHistoryResponse | null>(key, () => fetchStockIndicesHistory(normalized, range));
}

export function useStockIndicesSummaryLatest() {
  return useSWR<MarketAiSummary[]>("stock-indices-summary-latest", fetchStockIndicesSummaryLatest);
}

export function useStockIndicesSummaryByDate(date: string | null) {
  return useSWR<MarketAiSummary[]>(
    date ? ["stock-indices-summary-by-date", date] : null,
    () => fetchStockIndicesSummaryByDate(date ?? "")
  );
}
