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
  brief: LocalizedText;
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

export const INTELLIGENCE_SENTIMENTS = [-1, 0, 1] as const;
export type IntelligenceSentiment = (typeof INTELLIGENCE_SENTIMENTS)[number];

export const INTELLIGENCE_TARGET_TYPES = ["market", "asset"] as const;
export type IntelligenceTargetType = (typeof INTELLIGENCE_TARGET_TYPES)[number];

export const INTELLIGENCE_ASSET_CLASSES = ["crypto", "stocks", "macro"] as const;
export type IntelligenceAssetClass = (typeof INTELLIGENCE_ASSET_CLASSES)[number];

export type IntelligenceKeywordAlias = {
  keyword: string;
  assetClass: IntelligenceAssetClass;
  targetType: IntelligenceTargetType;
  targetId: string;
  labelZh: string;
  labelEn: string;
};

export type IntelligenceItem = {
  id: number;
  assetClass: IntelligenceAssetClass;
  targetType: IntelligenceTargetType;
  targetId: string;
  targetLabelZh: string;
  targetLabelEn: string;
  title: string;
  source: string;
  url: string;
  contentSummary: LocalizedText;
  sentiment: IntelligenceSentiment;
  importanceScore: number;
  timestamp: string;
  eventType: string;
  clusterId: number | null;
  topics: string[];
  keywords: string[];
};

export type IntelligenceWallColumns = {
  bullish: IntelligenceItem[];
  neutral: IntelligenceItem[];
  bearish: IntelligenceItem[];
};

export type IntelligenceMoverDiagnostic = {
  assetCode: string;
  assetLabelZh: string;
  assetLabelEn: string;
  reportDate: string;
  change24hPct: number;
  price: number;
  quoteVolume24hUsdt: number;
  primaryCause: IntelligenceItem | null;
  supportingItems: IntelligenceItem[];
};

export type IntelligenceTimelineAnchor = {
  assetCode: string;
  reportDate: string;
  clusterId: number;
  sentiment: IntelligenceSentiment;
  importanceScore: number;
  title: string;
};

export type IntelligenceWallResponse = {
  reportDate: string;
  generatedAt: string;
  overview: LocalizedText;
  columns: IntelligenceWallColumns;
  movers: IntelligenceMoverDiagnostic[];
  chartAnchors: IntelligenceTimelineAnchor[];
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

export type SchedulerJobFailureSummary = {
  jobKey: SchedulerJobKey;
  failures: SchedulerRunRecord[];
};

export type SchedulerStatusResponse = {
  generatedAt: string;
  retentionDays: number;
  jobs: SchedulerJobStatus[];
  recentRuns: SchedulerRunRecord[];
  jobFailures: SchedulerJobFailureSummary[];
};
