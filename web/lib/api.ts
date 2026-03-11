import "server-only";

const DEFAULT_API_BASE_URL = "https://crypto-daily-worker.404174262.workers.dev";

export type CoinItem = {
  rank: number;
  code: string;
  pair: string;
  nameZh: string;
  nameEn: string;
  corePositionZh: string;
  corePositionEn: string;
  annualQuoteVolumeUsdt: number;
  annualTradeSharePct: number;
  isActive: boolean;
};

export type DailySnapshot = {
  reportDate?: string;
  code: string;
  pair: string;
  priceUsdt: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  quoteVolume24hUsdt: number;
  tradeSharePct: number;
  closeTime: string;
};

export type DailyReport = {
  reportDate: string;
  generatedAt: string;
  summaryZh: string;
  summaryEn: string;
  totalQuoteVolumeUsdt: number;
  upCount: number;
  downCount: number;
  flatCount: number;
  leaderCode: string | null;
  leaderChange24hPct: number | null;
  laggardCode: string | null;
  laggardChange24hPct: number | null;
  items: DailySnapshot[];
};

export type ReportListItem = {
  reportDate: string;
  generatedAt: string;
  totalQuoteVolumeUsdt: number;
  upCount: number;
  downCount: number;
  flatCount: number;
};

export type CoinDetail = {
  coin: CoinItem;
  latestSnapshot: DailySnapshot | null;
  history: DailySnapshot[];
};

async function fetchJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: { accept: "application/json" }
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
  return fetchJson<DailyReport>(`/report/${date}`);
}

export async function fetchReports(limit = 30): Promise<ReportListItem[]> {
  const result = await fetchJson<{ items: ReportListItem[] }>(`/reports?limit=${Math.max(1, Math.min(limit, 120))}`);
  return result?.items ?? [];
}

export async function fetchCoinDetail(code: string): Promise<CoinDetail | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return fetchJson<CoinDetail>(`/coin/${encodeURIComponent(normalized)}`);
}
