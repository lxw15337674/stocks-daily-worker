export type ReportSource = "d1" | "r2";

export type LocalizedText = {
  zh: string | null;
  en: string | null;
};

export type ReportListItem = {
  reportDateEt: string;
  createdAt: string;
};

export type StockReportOverview = {
  stock: LocalizedText;
  news: LocalizedText;
};

export type StockReportQuoteItem = {
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  close: number;
  previousClose: number;
  changePct: number;
  volume: number;
  turnoverEstimate: number;
  currency: string;
};

export type StockReportNewsGroup = {
  symbol: string;
  name: string;
  displayName: string;
  changePct: number | null;
  items: StockNewsItem[];
};

export type StockDailyReport = {
  reportDateEt: string;
  createdAt: string;
  sampleSize: number;
  validQuoteCount: number;
  overview: StockReportOverview;
  items: StockReportQuoteItem[];
  newsGroups: StockReportNewsGroup[];
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
  aiSummary: LocalizedText;
};

export type StockHistoryPoint = StockQuoteSnapshot & {
  reportDateEt: string;
};

export type StockDetailResult = {
  stock: StockListItem;
  latestReportDateEt: string | null;
  latestQuote: StockQuoteSnapshot | null;
  latestAiSummary: LocalizedText;
  recentNews: StockNewsItem[];
  history: StockHistoryPoint[];
  reportRecords: StockReportRecord[];
};

export type ReportListResponse = {
  limit: number;
  nextCursor?: string | null;
  items: ReportListItem[];
};

export type StockListResponse = {
  items: StockListItem[];
};

export type StockDetailListResponse = {
  items: StockDetailResult[];
};

export const MARKET_REGIONS = ["cn", "hk", "us"] as const;
export type MarketRegion = (typeof MARKET_REGIONS)[number];

export const MARKET_INDEX_RANGES = ["1m", "3m", "1y"] as const;
export type MarketIndexRange = (typeof MARKET_INDEX_RANGES)[number];

export type MarketChartRange = MarketIndexRange;

export const MARKET_INDEX_KEYS = [
  "us_sp500",
  "us_nasdaq",
  "us_dow",
  "hk_hsi",
  "hk_hstech",
  "cn_sse",
  "cn_csi300",
  "cn_szse"
] as const;
export type MarketIndexKey = (typeof MARKET_INDEX_KEYS)[number];

export type MarketIndexLiveItem = {
  indexKey: MarketIndexKey | string;
  symbol: string;
  region: MarketRegion;
  nameZh: string;
  nameEn: string;
  price: number | null;
  previousClose: number | null;
  changeAbs: number | null;
  changePct: number | null;
  currency: string | null;
  quoteTimestamp: string | null;
  isPrimary: boolean;
};

export type MarketIndexLatestRegionGroup = {
  region: MarketRegion;
  primaryIndexKey: MarketIndexKey | string;
  items: MarketIndexLiveItem[];
};

export type MarketIndexLatestResponse = {
  updatedAt: string | null;
  regions: MarketIndexLatestRegionGroup[];
};

export type MarketIndexHistoryPoint = {
  tradingDate: string;
  close: number;
  changePct: number | null;
};

export type MarketIndexHistorySeries = {
  indexKey: MarketIndexKey | string;
  symbol: string;
  region: MarketRegion;
  nameZh: string;
  nameEn: string;
  points: MarketIndexHistoryPoint[];
};

export type MarketIndexHistoryResponse = {
  range: MarketIndexRange;
  series: MarketIndexHistorySeries[];
};

export type MarketIndexSnapshot = {
  indexKey: MarketIndexKey | string;
  symbol: string;
  region: MarketRegion;
  nameZh: string;
  nameEn: string;
  close: number;
  previousClose: number;
  changeAbs: number;
  changePct: number;
  currency: string;
  quoteTimestamp: string;
  isPrimary: boolean;
};

export type MarketAiSummary = {
  summaryDate: string;
  scope: string;
  summaryZh: string | null;
  summaryEn: string | null;
  model: string | null;
  snapshotCount: number;
  createdAt: string;
};

export type MarketAiSummaryRecord = {
  summaryDate: string;
  scope: string;
  summary: LocalizedText;
  snapshotCount: number;
  createdAt: string;
  items: MarketIndexSnapshot[];
  model?: string | null;
};

export type MarketAiSummaryResponse = {
  item: MarketAiSummary | null;
};

export type MarketIndicesAdminRunResponse = {
  ok: true;
  summaryDate: string;
  snapshotCount: number;
  summary: MarketAiSummary;
};

export const SCHEDULER_JOB_KEYS = [
  "stocks_daily_report",
  "market_indices_summary",
  "crypto_news_ingestion",
  "crypto_daily_report"
] as const;

export type SchedulerJobKey = (typeof SCHEDULER_JOB_KEYS)[number];

export const SCHEDULER_RUN_STATUSES = ["running", "success", "failed", "skipped"] as const;
export type SchedulerRunStatus = (typeof SCHEDULER_RUN_STATUSES)[number];

export const SCHEDULER_TRIGGER_TYPES = ["cron", "manual"] as const;
export type SchedulerTriggerType = (typeof SCHEDULER_TRIGGER_TYPES)[number];

export type SchedulerRunMetadataValue = string | number | boolean | null;
export type SchedulerRunMetadata = Record<string, SchedulerRunMetadataValue>;

export type SchedulerRunRecord = {
  attemptId: string;
  jobKey: SchedulerJobKey;
  triggerType: SchedulerTriggerType;
  triggerLabel: string | null;
  scheduledFor: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: SchedulerRunStatus;
  message: string | null;
  errorMessage: string | null;
  metadata: SchedulerRunMetadata | null;
};

export type SchedulerJobStatus = {
  jobKey: SchedulerJobKey;
  latest: SchedulerRunRecord | null;
};

export type SchedulerStatusResponse = {
  generatedAt: string;
  jobs: SchedulerJobStatus[];
  recentRuns: SchedulerRunRecord[];
};
