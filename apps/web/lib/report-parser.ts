export type ParsedReportStockRow = {
  company: string;
  code: string;
  symbol: string | null;
  businessType?: string | null;
  detailUrl: string | null;
  xueqiuUrl: string | null;
  closeText: string;
  closeValue: number | null;
  changeText: string;
  changeValue: number | null;
  newsCount?: number;
  streak?: {
    direction: "up" | "down" | "flat";
    count: number;
  };
  recentFiveDayReturn?: number | null;
  recentFiveDayNewsCount?: number;
  recentPositiveDays?: number;
  recentNegativeDays?: number;
};

export function buildExternalStockLink(code: string): string | null {
  const normalized = code.trim();
  if (!normalized) {
    return null;
  }

  return `https://xueqiu.com/S/${encodeURIComponent(normalized)}`;
}
