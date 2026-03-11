import type { LocalizedText, StockDailyReport } from "@/lib/api";
import type { Language } from "@/lib/i18n";
import { buildExternalStockLink, type ParsedReportStockRow } from "@/lib/report-parser";

export function resolveLocalizedText(text: LocalizedText, lang: Language): string | null {
  return (lang === "zh" ? text.zh : text.en) ?? text.zh ?? text.en ?? null;
}

function formatStockPrice(value: number, currency: string, lang: Language): string {
  try {
    return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatSignedPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function buildParsedRowsFromStockReport(report: StockDailyReport, lang: Language): ParsedReportStockRow[] {
  const newsCountBySymbol = new Map(report.newsGroups.map((group) => [group.symbol, group.items.length]));

  return report.items.map((item) => ({
    company: item.displayName,
    code: item.codes,
    symbol: item.symbol,
    businessType: item.businessType,
    detailUrl: null,
    xueqiuUrl: buildExternalStockLink(item.codes || item.symbol),
    closeText: formatStockPrice(item.close, item.currency, lang),
    closeValue: item.close,
    changeText: formatSignedPct(item.changePct),
    changeValue: item.changePct,
    newsCount: newsCountBySymbol.get(item.symbol) ?? 0
  }));
}
