import "server-only";

import { headers } from "next/headers";

import type {
  CoinDetail,
  CoinItem,
  CoinNewsItem,
  CryptoMacroSnapshot,
  DailyReport,
  MarketNewsItem,
  NewsClusterItem,
  NewsEventDetail,
  ReportDateNewsSnapshot,
  ReportListItem
} from "@/lib/crypto/types";

const DEFAULT_API_BASE_URL = "https://china-stocks-daily-worker.404174262.workers.dev";
type ApiTarget = {
  baseUrl: string;
  pathPrefix: string;
  cookieHeader: string | null;
};

function isLocalDevHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized.includes("localhost") || normalized.includes("127.0.0.1");
}

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
    return {
      baseUrl: DEFAULT_API_BASE_URL,
      pathPrefix: "/api/v1/crypto",
      cookieHeader
    };
  }

  if (isLocalDevHost(host)) {
    return {
      baseUrl: DEFAULT_API_BASE_URL,
      pathPrefix: "/api/v1/crypto",
      cookieHeader
    };
  }

  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || "https";

  return {
    baseUrl: stripTrailingSlashes(`${protocol}://${host}`),
    pathPrefix: "/api/crypto",
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

export async function fetchCoins(): Promise<CoinItem[]> {
  const result = await fetchJson<{ items: CoinItem[] }>("/coins");
  return result?.items ?? [];
}

export async function fetchLatestReport(): Promise<DailyReport | null> {
  return fetchJson<DailyReport>("/latest");
}

export async function fetchReportByDate(date: string): Promise<DailyReport | null> {
  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return null;
  }

  return fetchJson<DailyReport>(`/report/${encodeURIComponent(normalizedDate)}`);
}

export async function fetchReports(limit = 30): Promise<ReportListItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 120));
  const result = await fetchJson<{ items: ReportListItem[] }>(`/reports?limit=${normalizedLimit}`);
  return result?.items ?? [];
}

export async function fetchCoinDetail(code: string): Promise<CoinDetail | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  return fetchJson<CoinDetail>(`/coin/${encodeURIComponent(normalizedCode)}`);
}

export async function fetchMacroSnapshot(reportDate?: string | null): Promise<CryptoMacroSnapshot | null> {
  const normalizedDate = reportDate?.trim();
  if (normalizedDate) {
    return fetchJson<CryptoMacroSnapshot>(`/macro/report/${encodeURIComponent(normalizedDate)}`);
  }

  return fetchJson<CryptoMacroSnapshot>("/macro/latest");
}

export async function fetchMarketNews(limit = 8, hours = 36): Promise<MarketNewsItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const normalizedHours = Math.max(1, Math.min(hours, 168));
  const result = await fetchJson<{ items: MarketNewsItem[] }>(
    `/news/market/latest?limit=${normalizedLimit}&hours=${normalizedHours}`
  );
  return result?.items ?? [];
}

export async function fetchCoinNews(
  code: string,
  limit = 8,
  hours = 72,
  reportDate?: string | null
): Promise<CoinNewsItem[]> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return [];
  }

  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const normalizedHours = Math.max(1, Math.min(hours, 168));
  const query = new URLSearchParams({
    limit: String(normalizedLimit),
    hours: String(normalizedHours)
  });

  const normalizedDate = reportDate?.trim();
  if (normalizedDate) {
    query.set("date", normalizedDate);
  }

  const result = await fetchJson<{ coinCode: string; reportDate?: string | null; items: CoinNewsItem[] }>(
    `/news/coin/${encodeURIComponent(normalizedCode)}?${query.toString()}`
  );
  return result?.items ?? [];
}

export async function fetchNewsClusters(limit = 6, hours = 48): Promise<NewsClusterItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const normalizedHours = Math.max(1, Math.min(hours, 168));
  const result = await fetchJson<{ items: NewsClusterItem[] }>(
    `/news/clusters?limit=${normalizedLimit}&hours=${normalizedHours}`
  );
  return result?.items ?? [];
}

export async function fetchReportDateNews(date: string): Promise<ReportDateNewsSnapshot | null> {
  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return null;
  }

  return fetchJson<ReportDateNewsSnapshot>(`/news/report/${encodeURIComponent(normalizedDate)}`);
}

export async function fetchNewsEventDetail(clusterId: number): Promise<NewsEventDetail | null> {
  if (!Number.isInteger(clusterId) || clusterId <= 0) {
    return null;
  }

  return fetchJson<NewsEventDetail>(`/news/event/${clusterId}`);
}
