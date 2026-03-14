import "server-only";
import { headers } from "next/headers";
import { resolveServerApiTarget } from "@/lib/api-target";
import type { ApiTarget } from "@/lib/api-target";
import { SSR_API_BASE_URL } from "@/lib/runtime-config";
import type {
  LocalizedText,
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

type ApiModule = "stocks" | "crypto" | "root";

async function resolveApiTarget(module: ApiModule = "stocks"): Promise<ApiTarget> {
  const requestHeaders = await headers();
  const defaultPathPrefix = module === "root" ? "/api/v1" : `/api/v1/${module}`;
  return resolveServerApiTarget({
    defaultBaseUrl: SSR_API_BASE_URL,
    defaultPathPrefix,
    headers: requestHeaders
  });
}

type FetchJsonOptions = {
  revalidate?: number;
  includeCookies?: boolean;
  module?: ApiModule;
};

function buildApiRequestHeaders(target: ApiTarget, accept: string, includeCookies = false): Headers {
  const requestHeaders = new Headers({ accept });
  if (includeCookies && target.cookieHeader) {
    requestHeaders.set("cookie", target.cookieHeader);
  }
  return requestHeaders;
}

async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T | null> {
  const target = await resolveApiTarget(options.module);
  const response = await fetch(joinApiUrl(target, path), {
    method: "GET",
    next: options.revalidate ? { revalidate: options.revalidate } : undefined,
    cache: options.revalidate ? undefined : "no-store",
    headers: buildApiRequestHeaders(target, "application/json", options.includeCookies)
  });

  if (!response.ok) {
    console.error(`[web][${options.module ?? "stocks"}-api] ${path} -> ${response.status}`);
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    console.error(`[web][${options.module ?? "stocks"}-api] ${path} -> non-json response (${contentType || "unknown"})`);
    return null;
  }

  return (await response.json()) as T;
}

export type HomeBriefsResponse = {
  ok: boolean;
  items: {
    stocks: LocalizedText | null;
    crypto: LocalizedText | null;
  };
};

export async function fetchHomeBriefs(): Promise<HomeBriefsResponse["items"] | null> {
  const result = await fetchJson<HomeBriefsResponse>("/home/briefs", { module: "root", revalidate: 300 });
  return result?.items ?? null;
}

export async function fetchStockReportByDate(date: string): Promise<StockDailyReport | null> {
  const normalized = date?.trim?.() ?? "";
  if (!normalized) {
    return null;
  }

  return fetchJson<StockDailyReport>(`/report-data/${encodeURIComponent(normalized)}`, {
    module: "stocks",
    revalidate: 900
  });
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
