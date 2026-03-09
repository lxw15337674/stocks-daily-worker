import "server-only";
import { headers } from "next/headers";

const DEFAULT_API_BASE_URL = "https://china-stocks-daily-worker.404174262.workers.dev";

export type ReportListItem = {
  key: string;
  fileName: string;
  reportDateEt: string;
  createdAt: string;
  source: "d1" | "r2";
};

export type ReportByDateResult = {
  status: number;
  markdown: string | null;
};

export type StockListItem = {
  id: number;
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  aliases: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type StockQuoteSnapshot = {
  close: number;
  previousClose: number;
  changePct: number;
  volume: number;
  turnoverEstimate: number;
  currency: string;
};

export type StockNewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

export type StockHistoryPoint = StockQuoteSnapshot & {
  reportDateEt: string;
};

export type StockDetailResult = {
  stock: StockListItem;
  latestReportDateEt: string | null;
  latestQuote: StockQuoteSnapshot | null;
  latestAiSummary: string | null;
  recentNews: StockNewsItem[];
  history: StockHistoryPoint[];
};

type ReportListResponse = {
  source: "d1" | "r2";
  limit: number;
  cursor?: string | null;
  nextCursor?: string | null;
  items: ReportListItem[];
};

type StockListResponse = {
  items: StockListItem[];
};

type ApiTarget = {
  baseUrl: string;
  pathPrefix: string;
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
  if (!host) {
    return { baseUrl: DEFAULT_API_BASE_URL, pathPrefix: "" };
  }

  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  if (host.includes("localhost")) {
    return {
      baseUrl: stripTrailingSlashes(`${proto}://${host}`),
      pathPrefix: "/api"
    };
  }

  return { baseUrl: DEFAULT_API_BASE_URL, pathPrefix: "" };
}

async function fetchText(path: string): Promise<{ status: number; text: string; headers: Headers }> {
  const target = await resolveApiTarget();
  const response = await fetch(joinApiUrl(target, path), {
    method: "GET",
    cache: "no-store",
    headers: { accept: "text/markdown, text/plain;q=0.8, */*;q=0.5" }
  });

  return {
    status: response.status,
    text: await response.text(),
    headers: response.headers
  };
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const target = await resolveApiTarget();
  const response = await fetch(joinApiUrl(target, path), {
    method: "GET",
    cache: "no-store",
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchLatestMarkdown(): Promise<{ markdown: string; fileName?: string } | null> {
  const response = await fetchText("/latest");
  if (response.status !== 200) {
    return null;
  }

  return {
    markdown: response.text,
    fileName: response.headers.get("x-report-file") ?? undefined
  };
}

export async function fetchReportByDate(date: string): Promise<ReportByDateResult> {
  try {
    const response = await fetchText(`/report/${date}`);
    if (response.status !== 200) {
      return { status: response.status, markdown: null };
    }
    return { status: 200, markdown: response.text };
  } catch {
    return { status: 0, markdown: null };
  }
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
