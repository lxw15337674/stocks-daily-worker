import type { CoinDetail, CoinItem, DailyReport, ReportListItem } from "@/lib/crypto-types";

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
  const result = await fetchBrowserJson<{ items: CoinItem[] }>("/api/coins");
  return result?.items ?? [];
}

export async function fetchLatestReportClient(): Promise<DailyReport | null> {
  return fetchBrowserJson<DailyReport>("/api/latest");
}

export async function fetchReportByDateClient(date: string): Promise<DailyReport | null> {
  return fetchBrowserJson<DailyReport>(`/api/report/${encodeURIComponent(date)}`);
}

export async function fetchReportsClient(limit = 30): Promise<ReportListItem[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 120));
  const result = await fetchBrowserJson<{ items: ReportListItem[] }>(`/api/reports?limit=${normalizedLimit}`);
  return result?.items ?? [];
}

export async function fetchCoinDetailClient(code: string): Promise<CoinDetail | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }
  return fetchBrowserJson<CoinDetail>(`/api/coin/${encodeURIComponent(normalizedCode)}`);
}
