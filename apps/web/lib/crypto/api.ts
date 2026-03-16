import useSWR from "swr";

import { clientFetchJson } from "@/lib/client-fetch";
import type {
  CoinDetail,
  CoinItem,
  CoinNewsItem,
  CryptoMacroSnapshot,
  DailyReport,
  MarketNewsItem,
  NewsClusterItem,
  CryptoHomeSnapshot,
  NewsEventDetail,
  ReportDateNewsSnapshot,
  ReportListItem
} from "@/lib/crypto/types";
import type { IntelligenceWallResponse } from "@china-stocks/contracts";

function joinCryptoApi(path: string): string {
  return `/api/v1/crypto${path}`;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    return await clientFetchJson<T>(joinCryptoApi(path));
  } catch {
    return null;
  }
}

export async function fetchCoins(): Promise<CoinItem[]> {
  const result = await fetchJson<{ items: CoinItem[] }>("/coins");
  return result?.items ?? [];
}

export async function fetchLatestReport(): Promise<DailyReport | null> {
  return fetchJson<DailyReport>("/latest");
}

export async function fetchHomeSnapshot(): Promise<CryptoHomeSnapshot | null> {
  return fetchJson<CryptoHomeSnapshot>("/home-snapshot");
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
  const result = await fetchJson<{ items: NewsClusterItem[] }>(`/news/clusters?limit=${normalizedLimit}&hours=${normalizedHours}`);
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

export async function fetchIntelligenceLatest(): Promise<IntelligenceWallResponse | null> {
  return fetchJson<IntelligenceWallResponse>("/intelligence/latest");
}

export async function fetchIntelligenceReportByDate(date: string): Promise<IntelligenceWallResponse | null> {
  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return null;
  }

  return fetchJson<IntelligenceWallResponse>(`/intelligence/report/${encodeURIComponent(normalizedDate)}`);
}

export function useCoins() {
  return useSWR<CoinItem[]>("crypto-coins", fetchCoins);
}

export function useHomeSnapshot() {
  return useSWR<CryptoHomeSnapshot | null>("crypto-home-snapshot", fetchHomeSnapshot);
}

export function useLatestReport() {
  return useSWR<DailyReport | null>("crypto-latest-report", fetchLatestReport);
}

export function useReportByDate(date: string | null) {
  return useSWR<DailyReport | null>(date ? ["crypto-report-by-date", date] : null, () => fetchReportByDate(date ?? ""));
}

export function useReports(limit = 30) {
  return useSWR<ReportListItem[]>(["crypto-reports", limit], () => fetchReports(limit));
}

export function useCoinDetail(code: string | null) {
  return useSWR<CoinDetail | null>(code ? ["crypto-coin-detail", code] : null, () => fetchCoinDetail(code ?? ""));
}

export function useMacroSnapshot(reportDate?: string | null) {
  const key = reportDate ? ["crypto-macro-report-date", reportDate] : "crypto-macro-latest";
  return useSWR<CryptoMacroSnapshot | null>(key, () => fetchMacroSnapshot(reportDate));
}

export function useMarketNews(limit = 8, hours = 36) {
  return useSWR<MarketNewsItem[]>(["crypto-market-news", limit, hours], () => fetchMarketNews(limit, hours));
}

export function useCoinNews(code: string | null, limit = 8, hours = 72, reportDate?: string | null) {
  const key = code ? ["crypto-coin-news", code, limit, hours, reportDate ?? "latest"] : null;
  return useSWR<CoinNewsItem[]>(key, () => fetchCoinNews(code ?? "", limit, hours, reportDate));
}

export function useNewsClusters(limit = 6, hours = 48) {
  return useSWR<NewsClusterItem[]>(["crypto-news-clusters", limit, hours], () => fetchNewsClusters(limit, hours));
}

export function useReportDateNews(date: string | null) {
  return useSWR<ReportDateNewsSnapshot | null>(
    date ? ["crypto-report-date-news", date] : null,
    () => fetchReportDateNews(date ?? "")
  );
}

export function useNewsEventDetail(clusterId: number | null) {
  return useSWR<NewsEventDetail | null>(
    clusterId ? ["crypto-news-event", clusterId] : null,
    () => fetchNewsEventDetail(clusterId ?? 0)
  );
}

export function useIntelligenceLatest() {
  return useSWR<IntelligenceWallResponse | null>("crypto-intelligence-latest", fetchIntelligenceLatest);
}

export function useIntelligenceReportByDate(date: string | null) {
  return useSWR<IntelligenceWallResponse | null>(
    date ? ["crypto-intelligence-report-date", date] : null,
    () => fetchIntelligenceReportByDate(date ?? "")
  );
}

export type { IntelligenceWallResponse };
