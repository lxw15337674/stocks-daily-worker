import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { resolveApiTargetFromHeaders } from "@/lib/api-target";
import type { ApiTarget } from "@/lib/api-target";
import type {
  MarketAiSummary,
  MarketAiSummaryResponse,
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

const DEFAULT_API_BASE_URL = "https://china-stocks-daily-worker.404174262.workers.dev";
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

function joinApiUrl(target: ApiTarget, path: string): string {
  return `${target.baseUrl}${target.pathPrefix}${path}`;
}

const resolveApiTarget = cache(async (): Promise<ApiTarget> => {
  const requestHeaders = await headers();
  return resolveApiTargetFromHeaders({
    defaultBaseUrl: DEFAULT_API_BASE_URL,
    defaultPathPrefix: "/api/v1/stocks",
    proxyPathPrefix: "/api",
    headers: requestHeaders,
    remoteProtocolFallback: "https"
  });
});

type FetchJsonOptions = {
  revalidate?: number;
  includeCookies?: boolean;
};

function buildApiRequestHeaders(target: ApiTarget, accept: string, includeCookies = false): Headers {
  const requestHeaders = new Headers({ accept });
  if (includeCookies && target.cookieHeader) {
    requestHeaders.set("cookie", target.cookieHeader);
  }
  return requestHeaders;
}

async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T | null> {
  const target = await resolveApiTarget();
  const response = await fetch(joinApiUrl(target, path), {
    method: "GET",
    next: options.revalidate ? { revalidate: options.revalidate } : undefined,
    cache: options.revalidate ? undefined : "no-store",
    headers: buildApiRequestHeaders(target, "application/json", options.includeCookies)
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchStockReportByDate(date: string): Promise<StockDailyReport | null> {
  const normalized = date.trim();
  if (!normalized) {
    return null;
  }

  return fetchJson<StockDailyReport>(`/report-data/${encodeURIComponent(normalized)}`, { revalidate: 900 });
}

export async function fetchReportList(limit = 60): Promise<ReportListItem[]> {
  const result = await fetchJson<ReportListResponse>(`/reports?limit=${Math.max(1, Math.min(limit, 200))}`, {
    revalidate: 300
  });
  return result?.items ?? [];
}

export async function fetchStockList(): Promise<StockListItem[]> {
  const result = await fetchJson<StockListResponse>("/stocks", { revalidate: 3600 });
  return result?.items ?? [];
}

export async function fetchStockDetail(symbol: string): Promise<StockDetailResult | null> {
  const normalized = symbol.trim();
  if (!normalized) {
    return null;
  }
  return fetchJson<StockDetailResult>(`/stock/${encodeURIComponent(normalized)}`, { revalidate: 300 });
}

export async function fetchStockDetails(symbols: string[]): Promise<StockDetailResult[]> {
  const normalized = Array.from(new Set(symbols.map((symbol) => symbol.trim()).filter((symbol) => symbol.length > 0)));
  if (normalized.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    symbols: normalized.join(",")
  });
  const result = await fetchJson<StockDetailListResponse>(`/stocks/details?${query.toString()}`, { revalidate: 300 });
  return result?.items ?? [];
}

export async function fetchStockIndicesLatest(): Promise<MarketIndexLatestResponse | null> {
  return fetchJson<MarketIndexLatestResponse>("/indices/latest", { revalidate: 60 });
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
  return fetchJson<MarketIndexHistoryResponse>(`/indices/history?${query.toString()}`, { revalidate: 300 });
}

export async function fetchStockIndicesSummaryLatest(): Promise<MarketAiSummary | null> {
  const result = await fetchJson<MarketAiSummaryResponse>("/indices/summary/latest", { revalidate: 300 });
  return result?.item ?? null;
}

export async function fetchStockIndicesSummaryByDate(date: string): Promise<MarketAiSummary | null> {
  const normalized = date.trim();
  if (!normalized) {
    return null;
  }

  const result = await fetchJson<MarketAiSummaryResponse>(`/indices/summary/${encodeURIComponent(normalized)}`, {
    revalidate: 3600
  });
  return result?.item ?? null;
}
