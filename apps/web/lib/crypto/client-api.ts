import type {
  CoinDetail,
  CoinItem,
  CoinNewsItem,
  CryptoMacroSnapshot,
  DailyReport,
  MarketNewsItem,
  NewsEventDetail,
  NewsClusterItem,
  ReportDateNewsSnapshot,
  ReportListItem
} from "@/lib/crypto/types";

async function fetchBrowserJson<T>(path: string): Promise<T | null> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store",
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchCoinsClient(): Promise<CoinItem[]> {
  const result = await fetchBrowserJson<{ items: CoinItem[] }>("/api/crypto/coins");
  return result?.items ?? [];
}

export async function fetchLatestReportClient(): Promise<DailyReport | null> {
  return fetchBrowserJson<DailyReport>("/api/crypto/latest");
}

export async function fetchReportByDateClient(date: string): Promise<DailyReport | null> {
  return fetchBrowserJson<DailyReport>(`/api/crypto/report/${encodeURIComponent(date)}`);
}

export async function fetchReportsClient(limit = 30): Promise<ReportListItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 120));
  const result = await fetchBrowserJson<{ items: ReportListItem[] }>(`/api/crypto/reports?limit=${normalizedLimit}`);
  return result?.items ?? [];
}

export async function fetchCoinDetailClient(code: string): Promise<CoinDetail | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }
  return fetchBrowserJson<CoinDetail>(`/api/crypto/coin/${encodeURIComponent(normalizedCode)}`);
}

export async function fetchMacroSnapshotClient(reportDate?: string | null): Promise<CryptoMacroSnapshot | null> {
  if (reportDate?.trim()) {
    return fetchBrowserJson<CryptoMacroSnapshot>(`/api/crypto/macro/report/${encodeURIComponent(reportDate.trim())}`);
  }
  return fetchBrowserJson<CryptoMacroSnapshot>("/api/crypto/macro/latest");
}

export async function fetchMarketNewsClient(limit = 8, hours = 36): Promise<MarketNewsItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const normalizedHours = Math.max(1, Math.min(hours, 168));
  const result = await fetchBrowserJson<{ items: MarketNewsItem[] }>(
    `/api/crypto/news/market/latest?limit=${normalizedLimit}&hours=${normalizedHours}`
  );
  return result?.items ?? [];
}

export async function fetchCoinNewsClient(code: string, limit = 8, hours = 72, reportDate?: string | null): Promise<CoinNewsItem[]> {
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
  if (reportDate?.trim()) {
    query.set("date", reportDate.trim());
  }
  const result = await fetchBrowserJson<{ coinCode: string; reportDate?: string | null; items: CoinNewsItem[] }>(
    `/api/crypto/news/coin/${encodeURIComponent(normalizedCode)}?${query.toString()}`
  );
  return result?.items ?? [];
}

export async function fetchNewsClustersClient(limit = 6, hours = 48): Promise<NewsClusterItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const normalizedHours = Math.max(1, Math.min(hours, 168));
  const result = await fetchBrowserJson<{ items: NewsClusterItem[] }>(
    `/api/crypto/news/clusters?limit=${normalizedLimit}&hours=${normalizedHours}`
  );
  return result?.items ?? [];
}

export async function fetchReportDateNewsClient(date: string): Promise<ReportDateNewsSnapshot | null> {
  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return null;
  }
  return fetchBrowserJson<ReportDateNewsSnapshot>(`/api/crypto/news/report/${encodeURIComponent(normalizedDate)}`);
}

export async function fetchNewsEventDetailClient(clusterId: number): Promise<NewsEventDetail | null> {
  if (!Number.isInteger(clusterId) || clusterId <= 0) {
    return null;
  }
  return fetchBrowserJson<NewsEventDetail>(`/api/crypto/news/event/${clusterId}`);
}
