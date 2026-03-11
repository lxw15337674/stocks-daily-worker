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

export type StockReportRecord = {
  reportDateEt: string;
  close: number;
  changePct: number;
  newsCount: number;
  aiSummary: string | null;
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
  reportRecords: StockReportRecord[];
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

type StockDetailListResponse = {
  items: StockDetailResult[];
};

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

async function fetchText(path: string): Promise<{ status: number; text: string; headers: Headers }> {
  const target = await resolveApiTarget();
  const response = await fetch(joinApiUrl(target, path), {
    method: "GET",
    cache: "no-store",
    headers: buildApiRequestHeaders(target, "text/markdown, text/plain;q=0.8, */*;q=0.5")
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
    headers: buildApiRequestHeaders(target, "application/json")
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
