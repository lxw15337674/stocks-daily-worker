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
