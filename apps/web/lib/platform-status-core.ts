import type {
  MarketAiSummary,
  ReportListItem,
  SchedulerJobKey,
  SchedulerStatusResponse
} from "@china-stocks/contracts";
import type { CryptoMacroSnapshot, DailyReport, MarketNewsItem } from "@/lib/crypto/types";

export type PlatformFreshnessKey =
  | "stocks_report"
  | "market_indices_summary"
  | "crypto_daily_report"
  | "crypto_macro"
  | "crypto_news";

export type PlatformFreshnessState = "fresh" | "stale" | "missing";

export type PlatformFreshnessCard = {
  key: PlatformFreshnessKey;
  state: PlatformFreshnessState;
  updatedAt: string | null;
  primary: string;
  secondary: string | null;
};

export type PlatformStatusPageData = {
  generatedAt: string;
  scheduler: SchedulerStatusResponse;
  freshness: PlatformFreshnessCard[];
};

type BuildPlatformStatusDataInput = {
  scheduler: SchedulerStatusResponse | null;
  stockReports: ReportListItem[];
  marketSummary: MarketAiSummary | null;
  cryptoLatestReport: DailyReport | null;
  cryptoMacro: CryptoMacroSnapshot | null;
  cryptoMarketNews: MarketNewsItem[];
  now?: () => Date;
};

const JOB_KEYS: readonly SchedulerJobKey[] = [
  "stocks_daily_report",
  "market_indices_summary",
  "crypto_news_ingestion",
  "crypto_daily_report"
];

function createEmptySchedulerStatus(generatedAt: string): SchedulerStatusResponse {
  return {
    generatedAt,
    jobs: JOB_KEYS.map((jobKey) => ({ jobKey, latest: null })),
    recentRuns: []
  };
}

function toFreshnessState(timestamp: string | null, now: Date, staleAfterHours: number): PlatformFreshnessState {
  if (!timestamp) {
    return "missing";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "stale";
  }

  const ageHours = (now.getTime() - parsed.getTime()) / (1000 * 60 * 60);
  return ageHours <= staleAfterHours ? "fresh" : "stale";
}

export function buildPlatformStatusPageData(input: BuildPlatformStatusDataInput): PlatformStatusPageData {
  const now = (input.now ?? (() => new Date()))();
  const generatedAt = now.toISOString();
  const scheduler = input.scheduler ?? createEmptySchedulerStatus(generatedAt);
  const latestStockReport = input.stockReports[0] ?? null;
  const latestMarketNews = input.cryptoMarketNews[0] ?? null;

  return {
    generatedAt,
    scheduler,
    freshness: [
      {
        key: "stocks_report",
        state: toFreshnessState(latestStockReport?.createdAt ?? null, now, 36),
        updatedAt: latestStockReport?.createdAt ?? null,
        primary: latestStockReport?.reportDateEt ?? "-",
        secondary: latestStockReport ? `ET ${latestStockReport.reportDateEt}` : null
      },
      {
        key: "market_indices_summary",
        state: toFreshnessState(input.marketSummary?.createdAt ?? null, now, 36),
        updatedAt: input.marketSummary?.createdAt ?? null,
        primary: input.marketSummary?.summaryDate ?? "-",
        secondary: input.marketSummary ? `${input.marketSummary.snapshotCount} snapshots` : null
      },
      {
        key: "crypto_daily_report",
        state: toFreshnessState(input.cryptoLatestReport?.generatedAt ?? null, now, 36),
        updatedAt: input.cryptoLatestReport?.generatedAt ?? null,
        primary: input.cryptoLatestReport?.reportDate ?? "-",
        secondary: input.cryptoLatestReport ? `${input.cryptoLatestReport.items.length} instruments` : null
      },
      {
        key: "crypto_macro",
        state:
          input.cryptoMacro?.fearGreed.status === "unavailable" && input.cryptoMacro?.btcDominance.status === "unavailable"
            ? "missing"
            : input.cryptoMacro?.fearGreed.status === "stale" || input.cryptoMacro?.btcDominance.status === "stale"
              ? "stale"
              : toFreshnessState(input.cryptoMacro?.refreshedAt ?? null, now, 12),
        updatedAt: input.cryptoMacro?.refreshedAt ?? null,
        primary: input.cryptoMacro?.regime.labelEn ?? "-",
        secondary: input.cryptoMacro?.asOf ?? null
      },
      {
        key: "crypto_news",
        state: toFreshnessState(latestMarketNews?.publishedAt ?? null, now, 24),
        updatedAt: latestMarketNews?.publishedAt ?? null,
        primary: latestMarketNews?.source ?? "-",
        secondary: latestMarketNews?.title ?? null
      }
    ]
  };
}
