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

type ReportListResponse = {
  source: "d1" | "r2";
  limit: number;
  cursor?: string | null;
  nextCursor?: string | null;
  items: ReportListItem[];
};

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

async function resolveApiBaseUrl(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    return DEFAULT_API_BASE_URL;
  }

  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  if (host.includes("localhost")) {
    return stripTrailingSlashes(`${proto}://${host}`);
  }

  return DEFAULT_API_BASE_URL;
}

async function fetchText(path: string): Promise<{ status: number; text: string; headers: Headers }> {
  const base = await resolveApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
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
  const base = await resolveApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
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
  const response = await fetchText("/api/latest");
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
    const response = await fetchText(`/api/report/${date}`);
    if (response.status !== 200) {
      return { status: response.status, markdown: null };
    }
    return { status: 200, markdown: response.text };
  } catch {
    return { status: 0, markdown: null };
  }
}

export async function fetchReportList(limit = 60): Promise<ReportListItem[]> {
  const result = await fetchJson<ReportListResponse>(`/api/reports?limit=${Math.max(1, Math.min(limit, 200))}`);
  return result?.items ?? [];
}
