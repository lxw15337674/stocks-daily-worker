import "server-only";

import { headers } from "next/headers";
import type { SchedulerStatusResponse } from "@china-stocks/contracts";
import { resolveApiTargetFromHeaders } from "@/lib/api-target";
import type { ApiTarget } from "@/lib/api-target";
import { fetchReportList, fetchStockIndicesSummaryLatest } from "@/lib/api";
import { fetchLatestReport, fetchMacroSnapshot, fetchMarketNews } from "@/lib/crypto/api";
import { buildPlatformStatusPageData, type PlatformStatusPageData } from "@/lib/platform-status-core";

const DEFAULT_API_BASE_URL = "https://china-stocks-daily-worker.404174262.workers.dev";

function joinApiUrl(target: ApiTarget, path: string): string {
  return `${target.baseUrl}${target.pathPrefix}${path}`;
}

async function resolveRootApiTarget(): Promise<ApiTarget> {
  const requestHeaders = await headers();
  return resolveApiTargetFromHeaders({
    defaultBaseUrl: DEFAULT_API_BASE_URL,
    defaultPathPrefix: "/api/v1",
    proxyPathPrefix: "/api",
    headers: requestHeaders,
    remoteProtocolFallback: "https"
  });
}

function buildRequestHeaders(target: ApiTarget, accept: string): Headers {
  const requestHeaders = new Headers({ accept });
  if (target.cookieHeader) {
    requestHeaders.set("cookie", target.cookieHeader);
  }
  return requestHeaders;
}

export async function fetchSchedulerStatus(limit = 20): Promise<SchedulerStatusResponse | null> {
  const target = await resolveRootApiTarget();
  const response = await fetch(joinApiUrl(target, `/status/scheduler?limit=${Math.max(1, Math.min(limit, 100))}`), {
    method: "GET",
    cache: "no-store",
    headers: buildRequestHeaders(target, "application/json")
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SchedulerStatusResponse;
}

export async function loadPlatformStatusPageData(): Promise<PlatformStatusPageData> {
  const [scheduler, stockReports, marketSummary, cryptoLatestReport, cryptoMacro, cryptoMarketNews] = await Promise.all([
    fetchSchedulerStatus(24),
    fetchReportList(5),
    fetchStockIndicesSummaryLatest(),
    fetchLatestReport(),
    fetchMacroSnapshot(),
    fetchMarketNews(1, 168)
  ]);

  return buildPlatformStatusPageData({
    scheduler,
    stockReports,
    marketSummary,
    cryptoLatestReport,
    cryptoMacro,
    cryptoMarketNews
  });
}
