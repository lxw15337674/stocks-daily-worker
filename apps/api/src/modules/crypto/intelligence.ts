import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  IntelligenceItem,
  IntelligenceKeywordAlias,
  IntelligenceMoverDiagnostic,
  IntelligenceSentiment,
  IntelligenceTimelineAnchor,
  IntelligenceWallResponse,
  LocalizedText
} from "@china-stocks/contracts";

import { collectMatchingKeywords, getCryptoKeywordAliases } from "./entity-map.ts";
import { getReportDateNewsSnapshot, listCoinEventTimeline, type CoinNewsItem, type MarketNewsItem } from "./news.ts";
import { coins, dailyCoinSnapshots, dailyReports } from "./schema.ts";

const REPORT_MOVER_THRESHOLD_PCT = 5;
const ALERT_IMPORTANCE_THRESHOLD = 85;
const ALERT_LOOKBACK_HOURS = 12;

type CoinProfileRow = {
  code: string;
  nameZh: string;
  nameEn: string;
};

type ReportMoverRow = {
  code: string;
  priceUsdt: number;
  change24hPct: number;
  quoteVolume24hUsdt: number;
};

function toLocalizedText(zh: string | null | undefined, en: string | null | undefined): LocalizedText {
  return {
    zh: zh ?? null,
    en: en ?? null
  };
}

function toSentimentValue(stance: "bullish" | "bearish" | "neutral"): IntelligenceSentiment {
  if (stance === "bullish") {
    return 1;
  }
  if (stance === "bearish") {
    return -1;
  }
  return 0;
}

function sortIntelligenceItems(items: IntelligenceItem[]): IntelligenceItem[] {
  return [...items].sort(
    (left, right) =>
      right.importanceScore - left.importanceScore || right.timestamp.localeCompare(left.timestamp) || right.id - left.id
  );
}

async function loadCoinProfiles(db: D1Database): Promise<Map<string, CoinProfileRow>> {
  const orm = drizzle(db);
  const rows = await orm
    .select({
      code: coins.code,
      nameZh: coins.nameZh,
      nameEn: coins.nameEn
    })
    .from(coins);

  return new Map(rows.map((row) => [row.code, row]));
}

async function loadReportMovers(db: D1Database, reportDate: string): Promise<ReportMoverRow[]> {
  const orm = drizzle(db);
  const rows = await orm
    .select({
      code: dailyCoinSnapshots.code,
      priceUsdt: dailyCoinSnapshots.priceUsdt,
      change24hPct: dailyCoinSnapshots.change24hPct,
      quoteVolume24hUsdt: dailyCoinSnapshots.quoteVolume24hUsdt
    })
    .from(dailyCoinSnapshots)
    .innerJoin(dailyReports, eq(dailyCoinSnapshots.reportId, dailyReports.id))
    .where(eq(dailyReports.reportDate, reportDate))
    .orderBy(desc(dailyCoinSnapshots.quoteVolume24hUsdt));

  return rows
    .map((row) => ({
      code: row.code,
      priceUsdt: Number(row.priceUsdt ?? 0),
      change24hPct: Number(row.change24hPct ?? 0),
      quoteVolume24hUsdt: Number(row.quoteVolume24hUsdt ?? 0)
    }))
    .filter((row) => Math.abs(row.change24hPct) >= REPORT_MOVER_THRESHOLD_PCT)
    .sort((left, right) => Math.abs(right.change24hPct) - Math.abs(left.change24hPct) || right.quoteVolume24hUsdt - left.quoteVolume24hUsdt)
    .slice(0, 6);
}

async function loadLatestReportDate(db: D1Database): Promise<string | null> {
  const orm = drizzle(db);
  const rows = await orm
    .select({
      reportDate: dailyReports.reportDate
    })
    .from(dailyReports)
    .orderBy(desc(dailyReports.reportDate))
    .limit(1);

  return rows[0]?.reportDate ?? null;
}

function toMarketIntelligenceItem(item: MarketNewsItem): IntelligenceItem {
  return {
    id: item.id,
    assetClass: "crypto",
    targetType: "market",
    targetId: "crypto_market",
    targetLabelZh: "加密市场",
    targetLabelEn: "Crypto Market",
    title: item.title,
    source: item.source,
    url: item.url,
    contentSummary: toLocalizedText(item.summaryZh, item.summaryEn),
    sentiment: toSentimentValue(item.stance),
    importanceScore: Number(item.signalScore ?? 0),
    timestamp: item.publishedAt,
    eventType: item.eventType,
    clusterId: item.clusterId,
    topics: item.topics,
    keywords: collectMatchingKeywords(
      `${item.title}\n${item.summaryZh}\n${item.summaryEn}`.toLowerCase(),
      [],
      item.topics
    )
  };
}

function toCoinIntelligenceItem(item: CoinNewsItem, coinProfile: CoinProfileRow | undefined): IntelligenceItem {
  const targetId = coinProfile?.code ?? "UNKNOWN";
  return {
    id: item.id,
    assetClass: "crypto",
    targetType: "asset",
    targetId,
    targetLabelZh: coinProfile?.nameZh ?? targetId,
    targetLabelEn: coinProfile?.nameEn ?? targetId,
    title: item.title,
    source: item.source,
    url: item.url,
    contentSummary: toLocalizedText(item.summaryZh, item.summaryEn),
    sentiment: toSentimentValue(item.stance),
    importanceScore: Number(item.signalScore ?? 0),
    timestamp: item.publishedAt,
    eventType: item.eventType,
    clusterId: item.clusterId,
    topics: [],
    keywords: collectMatchingKeywords(
      `${item.title}\n${item.summaryZh}\n${item.summaryEn}`.toLowerCase(),
      [targetId],
      []
    )
  };
}

function buildOverview(
  reportDate: string,
  marketItems: IntelligenceItem[],
  movers: IntelligenceMoverDiagnostic[]
): LocalizedText {
  const bullishCount = marketItems.filter((item) => item.sentiment === 1).length;
  const bearishCount = marketItems.filter((item) => item.sentiment === -1).length;
  const topMover = movers[0] ?? null;

  return {
    zh: topMover
      ? `${reportDate} 的情报墙共整理 ${marketItems.length} 条高价值线索，偏多 ${bullishCount} 条、偏空 ${bearishCount} 条。异动最强的是 ${topMover.assetLabelZh}，24 小时涨跌幅 ${topMover.change24hPct.toFixed(2)}%，优先参考其主因卡片与支撑线索。`
      : `${reportDate} 的情报墙共整理 ${marketItems.length} 条高价值线索，偏多 ${bullishCount} 条、偏空 ${bearishCount} 条，可用于快速浏览当日市场叙事。`,
    en: topMover
      ? `${marketItems.length} curated intelligence items shape the ${reportDate} wall, with ${bullishCount} bullish and ${bearishCount} bearish signals. ${topMover.assetLabelEn} shows the largest move at ${topMover.change24hPct.toFixed(2)}%, so start with its primary cause card and supporting evidence.`
      : `${marketItems.length} curated intelligence items shape the ${reportDate} wall, with ${bullishCount} bullish and ${bearishCount} bearish signals for a quick read on the day's narrative.`
  };
}

export function listCryptoIntelligenceKeywordAliases(): IntelligenceKeywordAlias[] {
  return getCryptoKeywordAliases();
}

export async function buildCryptoIntelligenceWall(db: D1Database, reportDate: string): Promise<IntelligenceWallResponse> {
  const [snapshot, coinProfiles, movers] = await Promise.all([
    getReportDateNewsSnapshot(db, reportDate),
    loadCoinProfiles(db),
    loadReportMovers(db, reportDate)
  ]);

  const marketItems = snapshot.marketNews.map((item) => toMarketIntelligenceItem(item));
  const moverDiagnostics: IntelligenceMoverDiagnostic[] = [];
  const chartAnchors: IntelligenceTimelineAnchor[] = [];
  const moverItems: IntelligenceItem[] = [];

  for (const mover of movers) {
    const profile = coinProfiles.get(mover.code);
    const timeline = await listCoinEventTimeline(db, mover.code, { limit: 3 });
    const supportingItems = sortIntelligenceItems((snapshot.coinNewsByCode[mover.code] ?? []).map((item) => toCoinIntelligenceItem(item, profile))).slice(0, 3);

    const primaryCause = supportingItems[0] ?? null;
    if (supportingItems.length > 0) {
      moverItems.push(...supportingItems.slice(0, 2));
    }

    for (const eventItem of timeline) {
      chartAnchors.push({
        assetCode: mover.code,
        reportDate: eventItem.reportDate,
        clusterId: eventItem.clusterId,
        sentiment: toSentimentValue(eventItem.stance),
        importanceScore: Number(eventItem.importanceScore ?? 0),
        title: eventItem.label
      });
    }

    moverDiagnostics.push({
      assetCode: mover.code,
      assetLabelZh: profile?.nameZh ?? mover.code,
      assetLabelEn: profile?.nameEn ?? mover.code,
      reportDate,
      change24hPct: mover.change24hPct,
      price: mover.priceUsdt,
      quoteVolume24hUsdt: mover.quoteVolume24hUsdt,
      primaryCause,
      supportingItems
    });
  }

  const allItems = sortIntelligenceItems([...marketItems, ...moverItems]);

  return {
    reportDate,
    generatedAt: new Date().toISOString(),
    overview: buildOverview(reportDate, allItems, moverDiagnostics),
    columns: {
      bullish: allItems.filter((item) => item.sentiment === 1),
      neutral: allItems.filter((item) => item.sentiment === 0),
      bearish: allItems.filter((item) => item.sentiment === -1)
    },
    movers: moverDiagnostics,
    chartAnchors: chartAnchors.sort((left, right) => right.importanceScore - left.importanceScore || right.reportDate.localeCompare(left.reportDate))
  };
}

export async function notifyHighPriorityCryptoIntelligence(db: D1Database, webhookUrl?: string | null): Promise<number> {
  const normalizedWebhookUrl = webhookUrl?.trim() ?? "";
  if (!normalizedWebhookUrl) {
    return 0;
  }

  const latestReportDate = await loadLatestReportDate(db);
  if (!latestReportDate) {
    return 0;
  }

  const wall = await buildCryptoIntelligenceWall(db, latestReportDate);
  const cutoffTime = Date.now() - ALERT_LOOKBACK_HOURS * 60 * 60 * 1000;
  const items = [...wall.columns.bullish, ...wall.columns.bearish].filter((item) => {
    const timestamp = new Date(item.timestamp).getTime();
    return item.importanceScore >= ALERT_IMPORTANCE_THRESHOLD && Number.isFinite(timestamp) && timestamp >= cutoffTime;
  });

  if (items.length === 0) {
    return 0;
  }

  const response = await fetch(normalizedWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      reportDate: wall.reportDate,
      generatedAt: wall.generatedAt,
      itemCount: items.length,
      items: items.map((item) => ({
        id: item.id,
        targetId: item.targetId,
        targetLabelZh: item.targetLabelZh,
        targetLabelEn: item.targetLabelEn,
        title: item.title,
        sentiment: item.sentiment,
        importanceScore: item.importanceScore,
        timestamp: item.timestamp,
        source: item.source,
        url: item.url
      }))
    })
  });

  if (!response.ok) {
    throw new Error(`Webhook request failed with status ${response.status}.`);
  }

  return items.length;
}
