import "server-only";

import { headers } from "next/headers";
import { resolveServerApiTarget } from "@/lib/api-target";
import type { ApiTarget } from "@/lib/api-target";
import { SSR_API_BASE_URL } from "@/lib/runtime-config";

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
import type { IntelligenceWallResponse } from "@china-stocks/contracts";

function joinApiUrl(target: ApiTarget, path: string): string {
  return `${target.baseUrl}${target.pathPrefix}${path}`;
}

async function resolveApiTarget(): Promise<ApiTarget> {
  const requestHeaders = await headers();
  return resolveServerApiTarget({
    defaultBaseUrl: SSR_API_BASE_URL,
    defaultPathPrefix: "/api/v1/crypto",
    headers: requestHeaders
  });
}

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
    console.error(`[web][crypto-api] ${path} -> ${response.status}`);
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchCoins(): Promise<CoinItem[]> {
  const result = await fetchJson<{ items: CoinItem[] }>("/coins", { revalidate: 3600 });
  return result?.items ?? [];
}

export async function fetchLatestReport(): Promise<DailyReport | null> {
  return fetchJson<DailyReport>("/latest", { revalidate: 300 });
}

export async function fetchReportByDate(date: string): Promise<DailyReport | null> {
  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return null;
  }

  return fetchJson<DailyReport>(`/report/${encodeURIComponent(normalizedDate)}`, { revalidate: 1800 });
}

export async function fetchReports(limit = 30): Promise<ReportListItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 120));
  const result = await fetchJson<{ items: ReportListItem[] }>(`/reports?limit=${normalizedLimit}`, { revalidate: 300 });
  return result?.items ?? [];
}

export async function fetchCoinDetail(code: string): Promise<CoinDetail | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  return fetchJson<CoinDetail>(`/coin/${encodeURIComponent(normalizedCode)}`, { revalidate: 300 });
}

export async function fetchMacroSnapshot(reportDate?: string | null): Promise<CryptoMacroSnapshot | null> {
  const normalizedDate = reportDate?.trim();
  if (normalizedDate) {
    return fetchJson<CryptoMacroSnapshot>(`/macro/report/${encodeURIComponent(normalizedDate)}`, { revalidate: 1800 });
  }

  return fetchJson<CryptoMacroSnapshot>("/macro/latest", { revalidate: 300 });
}

export async function fetchMarketNews(limit = 8, hours = 36): Promise<MarketNewsItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const normalizedHours = Math.max(1, Math.min(hours, 168));
  const result = await fetchJson<{ items: MarketNewsItem[] }>(
    `/news/market/latest?limit=${normalizedLimit}&hours=${normalizedHours}`,
    { revalidate: 300 }
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
    `/news/coin/${encodeURIComponent(normalizedCode)}?${query.toString()}`,
    { revalidate: normalizedDate ? 1800 : 300 }
  );
  return result?.items ?? [];
}

export async function fetchNewsClusters(limit = 6, hours = 48): Promise<NewsClusterItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const normalizedHours = Math.max(1, Math.min(hours, 168));
  const result = await fetchJson<{ items: NewsClusterItem[] }>(
    `/news/clusters?limit=${normalizedLimit}&hours=${normalizedHours}`,
    { revalidate: 300 }
  );
  return result?.items ?? [];
}

export async function fetchReportDateNews(date: string): Promise<ReportDateNewsSnapshot | null> {
  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return null;
  }

  return fetchJson<ReportDateNewsSnapshot>(`/news/report/${encodeURIComponent(normalizedDate)}`, { revalidate: 1800 });
}

export async function fetchNewsEventDetail(clusterId: number): Promise<NewsEventDetail | null> {
  if (!Number.isInteger(clusterId) || clusterId <= 0) {
    return null;
  }

  return fetchJson<NewsEventDetail>(`/news/event/${clusterId}`, { revalidate: 1800 });
}

export async function fetchIntelligenceLatest(): Promise<IntelligenceWallResponse | null> {
  return fetchJson<IntelligenceWallResponse>("/intelligence/latest", { revalidate: 300 });
}

export async function fetchIntelligenceReportByDate(date: string): Promise<IntelligenceWallResponse | null> {
  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return null;
  }

  return fetchJson<IntelligenceWallResponse>(`/intelligence/report/${encodeURIComponent(normalizedDate)}`, {
    revalidate: 1800
  });
}

export type { IntelligenceWallResponse };
