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
  eventTimeline: CoinEventTimelineItem[];
};

export type CoinEventReactionPoint = {
  reportDate: string | null;
  priceUsdt: number | null;
  change24hPct: number | null;
  returnPct: number | null;
};

export type MacroIndicatorSnapshot = {
  key: "fear_and_greed" | "btc_dominance";
  assetCode: string | null;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  unit: "index" | "percent";
  classification: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  asOf: string | null;
  fetchedAt: string | null;
  status: "available" | "stale" | "unavailable";
};

export type MacroRegimeSnapshot = {
  code: "risk_on" | "risk_off" | "btc_defensive" | "alt_rotation" | "rangebound";
  labelZh: string;
  labelEn: string;
  summaryZh: string;
  summaryEn: string;
};

export type CryptoMacroSnapshot = {
  asOf: string | null;
  refreshedAt: string | null;
  regime: MacroRegimeSnapshot;
  fearGreed: MacroIndicatorSnapshot;
  btcDominance: MacroIndicatorSnapshot;
};

export type MarketNewsItem = {
  id: number;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summaryZh: string;
  summaryEn: string;
  topics: string[];
  eventType: string;
  stance: "bullish" | "bearish" | "neutral";
  signalScore: number;
  clusterId: number | null;
};

export type CoinNewsItem = {
  id: number;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summaryZh: string;
  summaryEn: string;
  eventType: string;
  stance: "bullish" | "bearish" | "neutral";
  signalScore: number;
  isPrimary: boolean;
  clusterId: number | null;
};

export type NewsClusterItem = {
  clusterId: number;
  label: string;
  importanceScore: number;
  marketImpact: "low" | "medium" | "high";
  stance: "bullish" | "bearish" | "neutral";
  associationScore: number | null;
  representative: {
    id: number;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
  };
  relatedCoins: string[];
  topics: string[];
  sourceCount: number;
};

export type NewsEventCoverageItem = {
  id: number;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summaryZh: string;
  summaryEn: string;
  eventType: string;
  stance: "bullish" | "bearish" | "neutral";
  signalScore: number;
  relatedCoins: string[];
  isRepresentative: boolean;
};

export type NewsEventCoinSnapshot = {
  reportDate: string;
  code: string;
  priceUsdt: number;
  change24hPct: number;
  quoteVolume24hUsdt: number;
  tradeSharePct: number;
};

export type NewsEventDetail = NewsClusterItem & {
  reportDate: string;
  coverage: NewsEventCoverageItem[];
  coinSnapshots: NewsEventCoinSnapshot[];
};

export type CoinEventTimelineItem = NewsClusterItem & {
  coinCode: string;
  reportDate: string;
  reaction: {
    event: CoinEventReactionPoint;
    next: CoinEventReactionPoint;
    day3: CoinEventReactionPoint;
  };
};

export type ReportDateNewsSnapshot = {
  reportDate: string;
  macro: CryptoMacroSnapshot;
  marketNews: MarketNewsItem[];
  clusters: NewsClusterItem[];
  coinNewsByCode: Record<string, CoinNewsItem[]>;
};
