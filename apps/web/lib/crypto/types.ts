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
  signalScore: number;
  isPrimary: boolean;
  clusterId: number | null;
};

export type NewsClusterItem = {
  clusterId: number;
  label: string;
  importanceScore: number;
  marketImpact: "low" | "medium" | "high";
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

export type ReportDateNewsSnapshot = {
  reportDate: string;
  marketNews: MarketNewsItem[];
  clusters: NewsClusterItem[];
  coinNewsByCode: Record<string, CoinNewsItem[]>;
};
