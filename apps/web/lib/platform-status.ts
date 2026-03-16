import useSWR from "swr";

import { clientFetchJson } from "@/lib/client-fetch";
import type { SchedulerStatusResponse } from "@china-stocks/contracts";
import { fetchReportList, fetchStockIndicesSummaryLatest } from "@/lib/api";
import { fetchLatestReport, fetchMacroSnapshot, fetchMarketNews } from "@/lib/crypto/api";
import { buildPlatformStatusPageData, type PlatformStatusPageData } from "@/lib/platform-status-core";

function joinRootApi(path: string): string {
  return `/api/v1${path}`;
}

export async function fetchSchedulerStatus(limit = 20): Promise<SchedulerStatusResponse | null> {
  try {
    return await clientFetchJson<SchedulerStatusResponse>(
      joinRootApi(`/status/scheduler?limit=${Math.max(1, Math.min(limit, 100))}`)
    );
  } catch {
    return null;
  }
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

export function usePlatformStatusPageData() {
  return useSWR<PlatformStatusPageData>("platform-status-page-data", loadPlatformStatusPageData);
}

