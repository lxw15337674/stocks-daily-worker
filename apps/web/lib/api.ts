import "server-only";
import { headers } from "next/headers";
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

type ApiTarget = {
  baseUrl: string;
  pathPrefix: string;
  cookieHeader: string | null;
};

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function joinApiUrl(target: ApiTarget, path: string): string {
  return `${target.baseUrl}${target.pathPrefix}${path}`;
}

async function resolveApiTarget(): Promise<ApiTarget> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const cookieHeader = requestHeaders.get("cookie");
  if (!host) {
    return { baseUrl: DEFAULT_API_BASE_URL, pathPrefix: "", cookieHeader };
  }

  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || (host.includes("localhost") ? "http" : "https");
  return {
    baseUrl: stripTrailingSlashes(`${protocol}://${host}`),
    pathPrefix: "/api",
    cookieHeader
  };
}

function buildApiRequestHeaders(target: ApiTarget, accept: string): Headers {
  const requestHeaders = new Headers({ accept });
  if (target.cookieHeader) {
    requestHeaders.set("cookie", target.cookieHeader);
  }
  return requestHeaders;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const target = await resolveApiTarget();
  const response = await fetch(joinApiUrl(target, path), {
    method: "GET",
    cache: "no-store",
    headers: buildApiRequestHeaders(target, "application/json")
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

  return fetchJson<StockDailyReport>(`/report-data/${encodeURIComponent(normalized)}`);
}

export async function fetchReportList(limit = 60): Promise<ReportListItem[]> {
  const result = await fetchJson<ReportListResponse>(`/reports?limit=${Math.max(1, Math.min(limit, 200))}`);
  return result?.items ?? [];
}

export async function fetchStockList(): Promise<StockListItem[]> {
  const result = await fetchJson<StockListResponse>("/stocks");
  return result?.items ?? [];
}

export async function fetchStockDetail(symbol: string): Promise<StockDetailResult | null> {
  const normalized = symbol.trim();
  if (!normalized) {
    return null;
  }
  return fetchJson<StockDetailResult>(`/stock/${encodeURIComponent(normalized)}`);
}

export async function fetchStockDetails(symbols: string[]): Promise<StockDetailResult[]> {
  const normalized = Array.from(new Set(symbols.map((symbol) => symbol.trim()).filter((symbol) => symbol.length > 0)));
  if (normalized.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    symbols: normalized.join(",")
  });
  const result = await fetchJson<StockDetailListResponse>(`/stocks/details?${query.toString()}`);
  return result?.items ?? [];
}

export async function fetchStockIndicesLatest(): Promise<MarketIndexLatestResponse | null> {
  return fetchJson<MarketIndexLatestResponse>("/indices/latest");
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
  return fetchJson<MarketIndexHistoryResponse>(`/indices/history?${query.toString()}`);
}

export async function fetchStockIndicesSummaryLatest(): Promise<MarketAiSummary | null> {
  const result = await fetchJson<MarketAiSummaryResponse>("/indices/summary/latest");
  return result?.item ?? null;
}

export async function fetchStockIndicesSummaryByDate(date: string): Promise<MarketAiSummary | null> {
  const normalized = date.trim();
  if (!normalized) {
    return null;
  }

  const result = await fetchJson<MarketAiSummaryResponse>(`/indices/summary/${encodeURIComponent(normalized)}`);
  return result?.item ?? null;
}
