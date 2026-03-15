import "server-only";

import { headers } from "next/headers";
import type { SchedulerStatusResponse } from "@china-stocks/contracts";
import { resolveServerApiTarget } from "@/lib/api-target";
import type { ApiTarget } from "@/lib/api-target";
import { fetchReportList, fetchStockIndicesSummaryLatest } from "@/lib/api";
import { fetchLatestReport, fetchMacroSnapshot, fetchMarketNews } from "@/lib/crypto/api";
import { buildPlatformStatusPageData, type PlatformStatusPageData } from "@/lib/platform-status-core";
import { APP_ENV, SSR_API_BASE_URL } from "@/lib/runtime-config";
import { safeFetchJson } from "@/lib/server-fetch";

function joinApiUrl(target: ApiTarget, path: string): string {
  return `${target.baseUrl}${target.pathPrefix}${path}`;
}
const IS_LOCAL_RUNTIME = String(APP_ENV).toLowerCase() === "local";

async function resolveRootApiTarget(): Promise<ApiTarget> {
  let requestHeaders: Pick<Headers, "get"> = {
    get(): string | null {
      return null;
    }
  };

  if (IS_LOCAL_RUNTIME) {
    try {
      requestHeaders = await headers();
    } catch (error) {
      console.warn("[web][status-api] headers() unavailable; local same-origin inference disabled", error);
    }
  }

  return resolveServerApiTarget({
    defaultBaseUrl: SSR_API_BASE_URL,
    defaultPathPrefix: "/api/v1",
    headers: requestHeaders,
    preferSameOriginInLocal: IS_LOCAL_RUNTIME
  });
}

function buildRequestHeaders(target: ApiTarget, accept: string, includeCookies = false): Headers {
  const requestHeaders = new Headers({ accept });
  if (includeCookies && target.cookieHeader) {
    requestHeaders.set("cookie", target.cookieHeader);
  }
  return requestHeaders;
}

export async function fetchSchedulerStatus(limit = 20): Promise<SchedulerStatusResponse | null> {
  const target = await resolveRootApiTarget();
  const path = `/status/scheduler?limit=${Math.max(1, Math.min(limit, 100))}`;
  return safeFetchJson<SchedulerStatusResponse>(joinApiUrl(target, path), {
    method: "GET",
    cache: "no-store",
    headers: buildRequestHeaders(target, "application/json")
  }, {
    logPrefix: "[web][status-api]",
    pathForLog: path
  });
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
