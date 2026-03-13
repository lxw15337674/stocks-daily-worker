import { Readability } from "@mozilla/readability";
import { and, asc, count, desc, eq, gte, inArray, like, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { parseHTML } from "linkedom";
import { detectMappedCoins } from "./entity-map.ts";
import { getReportDateCryptoMacroSnapshot, type CryptoMacroSnapshot } from "./macro.ts";
import {
  cryptoNewsClusterMembers,
  cryptoNewsClusters,
  cryptoNewsItemCoins,
  cryptoNewsItems,
  cryptoNewsItemTopics,
  cryptoNewsRaw,
  dailyCoinSnapshots,
  dailyReports
} from "./schema.ts";

export interface CryptoNewsEnv {
  DB?: D1Database;
  AI?: {
    run(model: string, input: unknown): Promise<unknown>;
  };
}

type CoinSeedLike = {
  code: string;
  nameZh: string;
  nameEn: string;
};

type NewsSourceType = "media" | "official" | "aggregator";
type RelevanceType = "coin" | "market" | "coin_and_market" | "irrelevant";
type EventType =
  | "announcement"
  | "listing"
  | "delisting"
  | "partnership"
  | "lawsuit"
  | "regulation"
  | "hack"
  | "exploit"
  | "network_upgrade"
  | "etf_flow"
  | "reserve_update"
  | "funding"
  | "adoption";

type MarketImpact = "low" | "medium" | "high";
type NewsStance = "bullish" | "bearish" | "neutral";

type FeedSource = {
  name: string;
  sourceType: NewsSourceType;
  url: string;
  itemLimit: number;
};

type CandidateNewsItem = {
  sourceName: string;
  sourceType: NewsSourceType;
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  snippet: string | null;
  bodyText: string | null;
  publishedAt: string;
  fetchedAt: string;
  rawHash: string;
  hintCoins: string[];
  hintTopics: string[];
};

type RawNewsRow = CandidateNewsItem & {
  id: number;
  ingestStatus: string;
};

type CuratedNewsRecord = {
  rawId: number;
  title: string;
  canonicalUrl: string;
  sourceName: string;
  sourceType: NewsSourceType;
  publishedAt: string;
  summaryZh: string;
  summaryEn: string;
  relevanceType: RelevanceType;
  eventType: EventType;
  signalScore: number;
  noiseScore: number;
  confidence: number;
  shouldDisplay: boolean;
  isMarketWide: boolean;
  reason: string;
  relatedCoins: string[];
  marketTopics: string[];
};

type ClusterInputItem = {
  id: number;
  title: string;
  sourceName: string;
  publishedAt: string;
  summaryZh: string;
  summaryEn: string;
  relatedCoins: string[];
  marketTopics: string[];
  signalScore: number;
};

type ClusterRecord = {
  clusterId: string;
  clusterLabel: string;
  representativeNewsId: number;
  memberNewsIds: number[];
  importanceScore: number;
  marketImpact: MarketImpact;
};

export type NewsIngestionResult = {
  fetchedRawCount: number;
  processedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  clusteredCount: number;
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
  stance: NewsStance;
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
  stance: NewsStance;
  signalScore: number;
  isPrimary: boolean;
  clusterId: number | null;
};

export type NewsClusterListItem = {
  clusterId: number;
  label: string;
  importanceScore: number;
  marketImpact: MarketImpact;
  stance: NewsStance;
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
  stance: NewsStance;
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

export type NewsEventDetail = NewsClusterListItem & {
  reportDate: string;
  coverage: NewsEventCoverageItem[];
  coinSnapshots: NewsEventCoinSnapshot[];
};

export type CoinEventReactionPoint = {
  reportDate: string | null;
  priceUsdt: number | null;
  change24hPct: number | null;
  returnPct: number | null;
};

export type CoinEventTimelineItem = NewsClusterListItem & {
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
  clusters: NewsClusterListItem[];
  coinNewsByCode: Record<string, CoinNewsItem[]>;
};

export type CryptoNewsAdminOverview = {
  pendingRawCount: number;
  processedRawCount: number;
  rejectedRawCount: number;
  failedRawCount: number;
  displayItemCount: number;
  hiddenItemCount: number;
  latestFetchedAt: string | null;
  latestPublishedAt: string | null;
};

export type CryptoNewsAdminRawItem = {
  id: number;
  sourceName: string;
  sourceType: NewsSourceType;
  title: string;
  canonicalUrl: string;
  publishedAt: string;
  fetchedAt: string;
  ingestStatus: string;
};

export type CryptoNewsAdminCuratedItem = {
  id: number;
  rawId: number;
  title: string;
  canonicalUrl: string;
  sourceName: string;
  publishedAt: string;
  relevanceType: RelevanceType;
  eventType: EventType;
  signalScore: number;
  noiseScore: number;
  confidence: number;
  shouldDisplay: boolean;
  isMarketWide: boolean;
  reason: string;
  relatedCoins: string[];
  topics: string[];
};

export type CryptoNewsAdminClusterListItem = {
  clusterId: number;
  label: string;
  importanceScore: number;
  marketImpact: MarketImpact;
  representativeNewsItemId: number;
  representativeTitle: string;
  representativeSource: string;
  representativePublishedAt: string;
  relatedCoins: string[];
  topics: string[];
  sourceCount: number;
  memberCount: number;
  updatedAt: string;
};

export type CryptoNewsAdminClusterMember = {
  id: number;
  rawId: number;
  title: string;
  canonicalUrl: string;
  sourceName: string;
  sourceType: NewsSourceType;
  publishedAt: string;
  summaryZh: string;
  summaryEn: string;
  eventType: string;
  stance: NewsStance;
  signalScore: number;
  noiseScore: number;
  confidence: number;
  shouldDisplay: boolean;
  isMarketWide: boolean;
  reason: string;
  relatedCoins: string[];
  topics: string[];
  isRepresentative: boolean;
};

export type CryptoNewsAdminClusterDetail = {
  cluster: NewsEventDetail;
  representativeNewsItemId: number;
  members: CryptoNewsAdminClusterMember[];
};

const NEWS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const NEWS_LOOKBACK_HOURS = 48;
const CLUSTER_LOOKBACK_HOURS = 72;
const GOOGLE_NEWS_ITEM_LIMIT = 6;
const DIRECT_FEED_ITEM_LIMIT = 10;
const CLASSIFICATION_BATCH_SIZE = 8;
const DEEP_SUMMARY_CONCURRENCY = 2;
const FEED_FETCH_TIMEOUT_MS = 8000;
const AI_REQUEST_TIMEOUT_MS = 8000;
const BODY_FETCH_TIMEOUT_MS = 4500;
const BODY_FETCH_MAX_CHARS = 800;
const TOPIC_CODES = ["regulation", "etf", "stablecoin", "exchange", "security", "macro", "infrastructure", "liquidity"] as const;
const EVENT_TYPES: EventType[] = [
  "announcement",
  "listing",
  "delisting",
  "partnership",
  "lawsuit",
  "regulation",
  "hack",
  "exploit",
  "network_upgrade",
  "etf_flow",
  "reserve_update",
  "funding",
  "adoption"
];
const RELEVANCE_TYPES: RelevanceType[] = ["coin", "market", "coin_and_market", "irrelevant"];
const MARKET_IMPACTS: MarketImpact[] = ["low", "medium", "high"];
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "ref_url"
]);

const DIRECT_FEEDS: FeedSource[] = [
  {
    name: "CoinDesk",
    sourceType: "media",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss",
    itemLimit: DIRECT_FEED_ITEM_LIMIT
  },
  {
    name: "Blockworks",
    sourceType: "media",
    url: "https://blockworks.com/feed",
    itemLimit: DIRECT_FEED_ITEM_LIMIT
  },
  {
    name: "Solana News",
    sourceType: "official",
    url: "https://solana.com/news/rss.xml",
    itemLimit: 8
  }
];

export function getCryptoNewsSchemaStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS crypto_news_raw (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      raw_hash TEXT NOT NULL,
      ingest_status TEXT NOT NULL DEFAULT 'pending'
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_news_raw_hash_unique ON crypto_news_raw(raw_hash)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_raw_published ON crypto_news_raw(published_at)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_raw_status ON crypto_news_raw(ingest_status)",
    `CREATE TABLE IF NOT EXISTS crypto_news_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      published_at TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      relevance_type TEXT NOT NULL,
      event_type TEXT NOT NULL,
      signal_score INTEGER NOT NULL,
      noise_score INTEGER NOT NULL,
      confidence REAL NOT NULL,
      should_display INTEGER NOT NULL DEFAULT 0,
      is_market_wide INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(raw_id) REFERENCES crypto_news_raw(id)
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_news_items_raw_id_unique ON crypto_news_items(raw_id)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_items_published ON crypto_news_items(published_at)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_items_display ON crypto_news_items(should_display, is_market_wide, published_at)",
    `CREATE TABLE IF NOT EXISTS crypto_news_item_coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      news_item_id INTEGER NOT NULL,
      coin_code TEXT NOT NULL,
      relation_confidence REAL NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(news_item_id) REFERENCES crypto_news_items(id)
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_news_item_coin_unique ON crypto_news_item_coins(news_item_id, coin_code)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_item_coin_code ON crypto_news_item_coins(coin_code, news_item_id)",
    `CREATE TABLE IF NOT EXISTS crypto_news_item_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      news_item_id INTEGER NOT NULL,
      topic_code TEXT NOT NULL,
      FOREIGN KEY(news_item_id) REFERENCES crypto_news_items(id)
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_news_item_topic_unique ON crypto_news_item_topics(news_item_id, topic_code)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_item_topic_code ON crypto_news_item_topics(topic_code, news_item_id)",
    `CREATE TABLE IF NOT EXISTS crypto_news_clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_key TEXT NOT NULL,
      cluster_label TEXT NOT NULL,
      representative_news_item_id INTEGER NOT NULL,
      importance_score INTEGER NOT NULL,
      market_impact TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY(representative_news_item_id) REFERENCES crypto_news_items(id)
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_news_clusters_key_unique ON crypto_news_clusters(cluster_key)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_clusters_rep ON crypto_news_clusters(representative_news_item_id)",
    `CREATE TABLE IF NOT EXISTS crypto_news_cluster_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_id INTEGER NOT NULL,
      news_item_id INTEGER NOT NULL,
      FOREIGN KEY(cluster_id) REFERENCES crypto_news_clusters(id),
      FOREIGN KEY(news_item_id) REFERENCES crypto_news_items(id)
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_news_cluster_member_unique ON crypto_news_cluster_members(cluster_id, news_item_id)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_news_cluster_member_item ON crypto_news_cluster_members(news_item_id, cluster_id)"
  ];
}

async function ensureCryptoNewsSchema(db: D1Database): Promise<void> {
  for (const statement of getCryptoNewsSchemaStatements()) {
    await db.prepare(statement).run();
  }
}

async function hydrateCuratedSummaries(env: CryptoNewsEnv, curatedRows: CuratedNewsRecord[]): Promise<CuratedNewsRecord[]> {
  return mapWithConcurrency(curatedRows, DEEP_SUMMARY_CONCURRENCY, async (row: CuratedNewsRecord) => {
    if (!shouldDeepReadForSummary(row)) {
      return row;
    }

    const bodyText = await fetchNewsBodySnippet(row.canonicalUrl, {
      timeoutMs: BODY_FETCH_TIMEOUT_MS,
      maxChars: BODY_FETCH_MAX_CHARS
    });
    if (!bodyText) {
      return row;
    }

    const nextSummary = await summarizeWithDeepBody(env, row, bodyText);
    if (!nextSummary) {
      return row;
    }

    return {
      ...row,
      summaryZh: nextSummary.summaryZh,
      summaryEn: nextSummary.summaryEn
    };
  });
}

export async function runHourlyNewsIngestion(env: CryptoNewsEnv, coins: CoinSeedLike[]): Promise<NewsIngestionResult> {
  if (!env.DB) {
    throw new Error("DB binding is required for crypto news ingestion.");
  }

  await ensureCryptoNewsSchema(env.DB);

  const candidates = await collectNewsCandidates(coins);
  const dedupedCandidates = dedupeCandidates(candidates);
  const rawRows = await persistRawCandidates(env.DB, dedupedCandidates);
  const pendingRows = rawRows.filter((row) => row.ingestStatus === "pending" || row.ingestStatus === "failed");
  const curatedRows = await classifyRawRows(env, pendingRows, coins);
  const hydratedRows = await hydrateCuratedSummaries(env, curatedRows);

  for (const curatedRow of hydratedRows) {
    await upsertCuratedNews(env.DB, curatedRow);
  }

  const clusteredCount = await rebuildNewsClusters(env, CLUSTER_LOOKBACK_HOURS);
  const acceptedCount = hydratedRows.filter((row) => row.shouldDisplay).length;

  return {
    fetchedRawCount: dedupedCandidates.length,
    processedCount: hydratedRows.length,
    acceptedCount,
    rejectedCount: hydratedRows.length - acceptedCount,
    clusteredCount
  };
}

export async function listMarketNews(
  db: D1Database,
  options: {
    limit: number;
    hours: number;
    topic?: string | null;
  }
): Promise<MarketNewsItem[]> {
  await ensureCryptoNewsSchema(db);

  const since = new Date(Date.now() - options.hours * 60 * 60 * 1000).toISOString();
  return listMarketNewsForWindow(db, {
    limit: options.limit,
    startIso: since,
    endIso: null,
    topic: options.topic ?? null
  });
}

async function listMarketNewsForWindow(
  db: D1Database,
  options: {
    limit: number;
    startIso: string;
    endIso: string | null;
    topic?: string | null;
  }
): Promise<MarketNewsItem[]> {
  const normalizedTopic = sanitizeTopicCode(options.topic ?? "");
  const orm = drizzle(db);
  const topicRows = normalizedTopic
    ? await orm
        .select({
          newsItemId: cryptoNewsItemTopics.newsItemId
        })
        .from(cryptoNewsItemTopics)
        .where(eq(cryptoNewsItemTopics.topicCode, normalizedTopic))
    : null;
  const topicNewsItemIds = topicRows ? [...new Set(topicRows.map((row) => Number(row.newsItemId)))] : null;
  if (normalizedTopic && (topicNewsItemIds?.length ?? 0) === 0) {
    return [];
  }

  const filters = [
    eq(cryptoNewsItems.shouldDisplay, true),
    eq(cryptoNewsItems.isMarketWide, true),
    gte(cryptoNewsItems.publishedAt, options.startIso)
  ];
  if (options.endIso) {
    filters.push(lt(cryptoNewsItems.publishedAt, options.endIso));
  }
  if (topicNewsItemIds) {
    filters.push(inArray(cryptoNewsItems.id, topicNewsItemIds));
  }

  const rows = await orm
    .select({
      id: cryptoNewsItems.id,
      title: cryptoNewsItems.title,
      url: cryptoNewsItems.canonicalUrl,
      source: cryptoNewsItems.sourceName,
      publishedAt: cryptoNewsItems.publishedAt,
      summaryZh: cryptoNewsItems.summaryZh,
      summaryEn: cryptoNewsItems.summaryEn,
      eventType: cryptoNewsItems.eventType,
      signalScore: cryptoNewsItems.signalScore
    })
    .from(cryptoNewsItems)
    .where(and(...filters))
    .orderBy(desc(cryptoNewsItems.publishedAt), desc(cryptoNewsItems.signalScore))
    .limit(Math.max(options.limit * 4, options.limit));

  const newsItemIds = rows.map((row) => Number(row.id));
  const [taxonomy, visibility] = await Promise.all([
    getNewsItemTaxonomy(db, newsItemIds),
    getNewsItemClusterVisibility(db, newsItemIds)
  ]);

  const out: MarketNewsItem[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    const clusterId = resolveVisibleClusterId(id, visibility);
    if (typeof clusterId === "undefined") {
      continue;
    }

    const topics = taxonomy.topicCodesByNewsItemId.get(id) ?? [];
    out.push({
      id,
      title: row.title,
      url: row.url,
      source: row.source,
      publishedAt: row.publishedAt,
      summaryZh: row.summaryZh,
      summaryEn: row.summaryEn,
      eventType: row.eventType,
      stance: deriveNewsStance(row.eventType, topics, row.title),
      topics,
      signalScore: Number(row.signalScore ?? 0),
      clusterId
    });
    if (out.length >= options.limit) {
      break;
    }
  }

  return out;
}

export async function listCoinNews(
  db: D1Database,
  coinCode: string,
  options: {
    limit: number;
    hours: number;
    reportDate?: string | null;
  }
): Promise<CoinNewsItem[]> {
  await ensureCryptoNewsSchema(db);

  if (options.reportDate) {
    const { startIso, endIso } = getReportDateWindow(options.reportDate);
    return listCoinNewsForWindow(db, coinCode, {
      limit: options.limit,
      startIso,
      endIso
    });
  }
  const since = new Date(Date.now() - options.hours * 60 * 60 * 1000).toISOString();
  return listCoinNewsForWindow(db, coinCode, {
    limit: options.limit,
    startIso: since,
    endIso: null
  });
}

async function listCoinNewsForWindow(
  db: D1Database,
  coinCode: string,
  options: {
    limit: number;
    startIso: string;
    endIso: string | null;
  }
): Promise<CoinNewsItem[]> {
  const orm = drizzle(db);
  const filters = [eq(cryptoNewsItems.shouldDisplay, true), eq(cryptoNewsItemCoins.coinCode, coinCode), gte(cryptoNewsItems.publishedAt, options.startIso)];
  if (options.endIso) {
    filters.push(lt(cryptoNewsItems.publishedAt, options.endIso));
  }

  const rows = await orm
    .select({
      id: cryptoNewsItems.id,
      title: cryptoNewsItems.title,
      url: cryptoNewsItems.canonicalUrl,
      source: cryptoNewsItems.sourceName,
      publishedAt: cryptoNewsItems.publishedAt,
      summaryZh: cryptoNewsItems.summaryZh,
      summaryEn: cryptoNewsItems.summaryEn,
      eventType: cryptoNewsItems.eventType,
      signalScore: cryptoNewsItems.signalScore,
      isPrimary: cryptoNewsItemCoins.isPrimary
    })
    .from(cryptoNewsItems)
    .innerJoin(cryptoNewsItemCoins, eq(cryptoNewsItemCoins.newsItemId, cryptoNewsItems.id))
    .where(and(...filters))
    .orderBy(desc(cryptoNewsItems.publishedAt), desc(cryptoNewsItems.signalScore))
    .limit(Math.max(options.limit * 4, options.limit));

  const visibility = await getNewsItemClusterVisibility(
    db,
    rows.map((row) => Number(row.id))
  );

  const out: CoinNewsItem[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    const clusterId = resolveVisibleClusterId(id, visibility);
    if (typeof clusterId === "undefined") {
      continue;
    }

    out.push({
      id,
      title: row.title,
      url: row.url,
      source: row.source,
      publishedAt: row.publishedAt,
      summaryZh: row.summaryZh,
      summaryEn: row.summaryEn,
      eventType: row.eventType,
      stance: deriveNewsStance(row.eventType, [], row.title),
      signalScore: Number(row.signalScore ?? 0),
      isPrimary: !!row.isPrimary,
      clusterId
    });
    if (out.length >= options.limit) {
      break;
    }
  }

  return out;
}

export async function listRecentNewsClusters(
  db: D1Database,
  options: {
    limit: number;
    hours: number;
  }
): Promise<NewsClusterListItem[]> {
  await ensureCryptoNewsSchema(db);

  const since = new Date(Date.now() - options.hours * 60 * 60 * 1000).toISOString();
  return listRecentNewsClustersForWindow(db, {
    limit: options.limit,
    startIso: since,
    endIso: null
  });
}

async function listRecentNewsClustersForWindow(
  db: D1Database,
  options: {
    limit: number;
    startIso: string;
    endIso: string | null;
  }
): Promise<NewsClusterListItem[]> {
  const orm = drizzle(db);
  const filters = [gte(cryptoNewsItems.publishedAt, options.startIso)];
  if (options.endIso) {
    filters.push(lt(cryptoNewsItems.publishedAt, options.endIso));
  }

  const rows = await orm
    .select({
      clusterId: cryptoNewsClusters.id
    })
    .from(cryptoNewsClusters)
    .innerJoin(cryptoNewsItems, eq(cryptoNewsItems.id, cryptoNewsClusters.representativeNewsItemId))
    .where(and(...filters))
    .orderBy(desc(cryptoNewsClusters.importanceScore), desc(cryptoNewsItems.publishedAt))
    .limit(options.limit);

  const details = await Promise.all(rows.map((row) => getNewsEventDetail(db, Number(row.clusterId))));
  return details
    .filter((detail): detail is NewsEventDetail => !!detail)
    .map((detail) => ({
      clusterId: detail.clusterId,
      label: detail.label,
      importanceScore: detail.importanceScore,
      marketImpact: detail.marketImpact,
      stance: detail.stance,
      associationScore: detail.associationScore,
      representative: detail.representative,
      relatedCoins: detail.relatedCoins,
      topics: detail.topics,
      sourceCount: detail.sourceCount
    }));
}

export async function getReportDateNewsSnapshot(db: D1Database, reportDate: string): Promise<ReportDateNewsSnapshot> {
  await ensureCryptoNewsSchema(db);

  const { startIso, endIso } = getReportDateWindow(reportDate);
  const [macro, marketNews, clusters, coinNewsByCode] = await Promise.all([
    getReportDateCryptoMacroSnapshot(db, reportDate),
    listMarketNewsForWindow(db, {
      limit: 24,
      startIso,
      endIso,
      topic: null
    }),
    listRecentNewsClustersForWindow(db, {
      limit: 12,
      startIso,
      endIso
    }),
    getCoinNewsByCodeForWindow(db, {
      startIso,
      endIso,
      limitPerCoin: 3
    })
  ]);

  return {
    reportDate,
    macro,
    marketNews,
    clusters,
    coinNewsByCode
  };
}

export async function getNewsEventDetail(db: D1Database, clusterId: number): Promise<NewsEventDetail | null> {
  await ensureCryptoNewsSchema(db);

  const base = await getClusterBaseRecord(db, clusterId);
  if (!base) {
    return null;
  }

  const reportDate = formatIsoDate(base.representativePublishedAt);
  const clusterNewsItemIds = await getClusterNewsItemIds(db, clusterId, base.representativeId);
  const coverageContext = await getClusterNewsItemContext(db, clusterNewsItemIds);
  const orderedItemRows = sortClusterNewsItems(coverageContext.itemRows, base.representativeId);
  const coverage = orderedItemRows.map((row) => {
    const topics = coverageContext.topicCodesByNewsItemId.get(row.id) ?? [];
    return {
      id: Number(row.id),
      title: row.title,
      url: row.canonicalUrl,
      source: row.sourceName,
      publishedAt: row.publishedAt,
      summaryZh: row.summaryZh,
      summaryEn: row.summaryEn,
      eventType: row.eventType,
      stance: deriveNewsStance(row.eventType, topics, row.title),
      signalScore: Number(row.signalScore ?? 0),
      relatedCoins: coverageContext.coinCodesByNewsItemId.get(row.id) ?? [],
      isRepresentative: row.id === base.representativeId
    };
  });

  const baseCluster: NewsClusterListItem = {
    clusterId: base.clusterId,
    label: base.label,
    importanceScore: base.importanceScore,
    marketImpact: sanitizeMarketImpact(base.marketImpact),
    stance: deriveNewsStance(base.representativeEventType, coverageContext.topicCodes, base.label),
    associationScore: null,
    representative: {
      id: base.representativeId,
      title: base.representativeTitle,
      url: base.representativeUrl,
      source: base.representativeSource,
      publishedAt: base.representativePublishedAt
    },
    relatedCoins: coverageContext.coinCodes,
    topics: coverageContext.topicCodes,
    sourceCount: Math.max(1, coverageContext.sourceNames.length)
  };

  const [enrichedClusters, coinSnapshots] = await Promise.all([
    attachClusterAssociationScores(db, reportDate, [baseCluster]),
    listEventCoinSnapshots(db, reportDate, baseCluster.relatedCoins)
  ]);

  return {
    ...(enrichedClusters[0] ?? baseCluster),
    reportDate,
    coverage,
    coinSnapshots
  };
}

export async function listCoinEventTimeline(
  db: D1Database,
  coinCode: string,
  options: {
    limit: number;
  }
): Promise<CoinEventTimelineItem[]> {
  await ensureCryptoNewsSchema(db);

  const normalizedCode = coinCode.trim().toUpperCase();
  if (!normalizedCode) {
    return [];
  }

  const orderedClusterIds = await listClusterIdsByCoin(db, normalizedCode, Math.max(1, options.limit * 2));
  if (orderedClusterIds.length === 0) {
    return [];
  }

  const priceHistory = await listCoinPriceHistoryPoints(db, normalizedCode, 120);

  const details = await Promise.all(
    orderedClusterIds.map(async (clusterId) => {
      const detail = await getNewsEventDetail(db, clusterId);
      if (!detail || !detail.relatedCoins.includes(normalizedCode)) {
        return null;
      }
      return detail;
    })
  );

  return details
    .filter((detail): detail is NewsEventDetail => !!detail)
    .slice(0, options.limit)
    .map((detail) => ({
      ...detail,
      coinCode: normalizedCode,
      reaction: buildCoinEventReaction(priceHistory, detail.reportDate)
    }));
}

export async function listCryptoNewsAdminClusters(
  db: D1Database,
  options: {
    limit: number;
    query: string | null;
    coinCode: string | null;
  }
): Promise<CryptoNewsAdminClusterListItem[]> {
  await ensureCryptoNewsSchema(db);

  const normalizedQuery = options.query?.trim() ?? "";
  const normalizedCoinCode = options.coinCode?.trim().toUpperCase() ?? "";
  const orm = drizzle(db);
  const coinClusterIds = normalizedCoinCode ? await listClusterIdsByCoin(db, normalizedCoinCode, 400) : null;
  if (coinClusterIds && coinClusterIds.length === 0) {
    return [];
  }

  const filters = [];
  if (normalizedQuery) {
    const queryLike = `%${normalizedQuery}%`;
    filters.push(
      or(
        like(cryptoNewsClusters.clusterLabel, queryLike),
        like(cryptoNewsItems.title, queryLike),
        like(cryptoNewsItems.sourceName, queryLike)
      )!
    );
  }
  if (coinClusterIds) {
    filters.push(inArray(cryptoNewsClusters.id, coinClusterIds));
  }

  const baseQuery = orm
    .select({
      clusterId: cryptoNewsClusters.id,
      label: cryptoNewsClusters.clusterLabel,
      importanceScore: cryptoNewsClusters.importanceScore,
      marketImpact: cryptoNewsClusters.marketImpact,
      representativeNewsItemId: cryptoNewsClusters.representativeNewsItemId,
      updatedAt: cryptoNewsClusters.updatedAt,
      representativeTitle: cryptoNewsItems.title,
      representativeSource: cryptoNewsItems.sourceName,
      representativePublishedAt: cryptoNewsItems.publishedAt
    })
    .from(cryptoNewsClusters)
    .innerJoin(cryptoNewsItems, eq(cryptoNewsClusters.representativeNewsItemId, cryptoNewsItems.id));
  const whereClause = filters.length === 0 ? null : filters.length === 1 ? filters[0] : and(...filters);
  const rows = await (whereClause
    ? baseQuery.where(whereClause).orderBy(desc(cryptoNewsClusters.updatedAt), desc(cryptoNewsItems.publishedAt)).limit(options.limit)
    : baseQuery.orderBy(desc(cryptoNewsClusters.updatedAt), desc(cryptoNewsItems.publishedAt)).limit(options.limit));

  const details = await Promise.all(rows.map((row) => getNewsEventDetail(db, Number(row.clusterId))));
  return rows
    .map((row, index) => {
      const detail = details[index];
      if (!detail) {
        return null;
      }
      return {
        clusterId: Number(row.clusterId),
        label: row.label,
        importanceScore: Number(row.importanceScore ?? 0),
        marketImpact: sanitizeMarketImpact(row.marketImpact),
        representativeNewsItemId: Number(row.representativeNewsItemId),
        representativeTitle: row.representativeTitle,
        representativeSource: row.representativeSource,
        representativePublishedAt: row.representativePublishedAt,
        relatedCoins: detail.relatedCoins,
        topics: detail.topics,
        sourceCount: detail.sourceCount,
        memberCount: detail.coverage.length,
        updatedAt: row.updatedAt
      };
    })
    .filter((item): item is CryptoNewsAdminClusterListItem => !!item);
}

export async function getCryptoNewsAdminClusterDetail(
  db: D1Database,
  clusterId: number
): Promise<CryptoNewsAdminClusterDetail | null> {
  const cluster = await getNewsEventDetail(db, clusterId);
  if (!cluster) {
    return null;
  }

  const clusterNewsItemIds = await getClusterNewsItemIds(db, clusterId, cluster.representative.id);
  if (clusterNewsItemIds.length === 0) {
    return {
      cluster,
      representativeNewsItemId: cluster.representative.id,
      members: []
    };
  }

  const coverageContext = await getClusterNewsItemContext(db, clusterNewsItemIds);
  const orderedItemRows = sortClusterNewsItems(coverageContext.itemRows, cluster.representative.id);

  return {
    cluster,
    representativeNewsItemId: cluster.representative.id,
    members: orderedItemRows.map((row) => ({
      id: Number(row.id),
      rawId: Number(row.rawId),
      title: row.title,
      canonicalUrl: row.canonicalUrl,
      sourceName: row.sourceName,
      sourceType: row.sourceType,
      publishedAt: row.publishedAt,
      summaryZh: row.summaryZh,
      summaryEn: row.summaryEn,
      eventType: row.eventType,
      stance: deriveNewsStance(row.eventType, coverageContext.topicCodesByNewsItemId.get(row.id) ?? [], row.title),
      signalScore: Number(row.signalScore ?? 0),
      noiseScore: Number(row.noiseScore ?? 0),
      confidence: Number(row.confidence ?? 0),
      shouldDisplay: !!row.shouldDisplay,
      isMarketWide: !!row.isMarketWide,
      reason: row.reason,
      relatedCoins: coverageContext.coinCodesByNewsItemId.get(row.id) ?? [],
      topics: coverageContext.topicCodesByNewsItemId.get(row.id) ?? [],
      isRepresentative: row.id === cluster.representative.id
    }))
  };
}

export async function setCryptoNewsClusterRepresentative(
  db: D1Database,
  clusterId: number,
  newsItemId: number
): Promise<CryptoNewsAdminClusterDetail | null> {
  await ensureCryptoNewsSchema(db);

  const orm = drizzle(db);
  const clusterRows = await orm
    .select({
      representativeNewsItemId: cryptoNewsClusters.representativeNewsItemId
    })
    .from(cryptoNewsClusters)
    .where(eq(cryptoNewsClusters.id, clusterId))
    .limit(1);
  const clusterRow = clusterRows[0];
  if (!clusterRow) {
    return null;
  }

  const clusterNewsItemIds = await getClusterNewsItemIds(db, clusterId, Number(clusterRow.representativeNewsItemId));
  if (!clusterNewsItemIds.includes(newsItemId)) {
    return null;
  }

  const nextRepresentativeRows = await orm
    .select({
      id: cryptoNewsItems.id,
      title: cryptoNewsItems.title
    })
    .from(cryptoNewsItems)
    .where(eq(cryptoNewsItems.id, newsItemId))
    .limit(1);
  const nextRepresentative = nextRepresentativeRows[0];
  if (!nextRepresentative) {
    return null;
  }

  const currentRepresentativeId = Number(clusterRow.representativeNewsItemId);
  if (currentRepresentativeId !== Number(nextRepresentative.id)) {
    await orm
      .insert(cryptoNewsClusterMembers)
      .values({
        clusterId,
        newsItemId: currentRepresentativeId
      })
      .onConflictDoNothing();

    await orm
      .update(cryptoNewsClusters)
      .set({
        representativeNewsItemId: Number(nextRepresentative.id),
        clusterLabel: nextRepresentative.title,
        updatedAt: new Date().toISOString()
      })
      .where(eq(cryptoNewsClusters.id, clusterId));
  }

  return getCryptoNewsAdminClusterDetail(db, clusterId);
}

async function getClusterBaseRecord(
  db: D1Database,
  clusterId: number
): Promise<{
  clusterId: number;
  label: string;
  importanceScore: number;
  marketImpact: MarketImpact;
  representativeId: number;
  representativeTitle: string;
  representativeUrl: string;
  representativeSource: string;
  representativePublishedAt: string;
  representativeEventType: string;
} | null> {
  const orm = drizzle(db);
  const rows = await orm
    .select({
      clusterId: cryptoNewsClusters.id,
      label: cryptoNewsClusters.clusterLabel,
      importanceScore: cryptoNewsClusters.importanceScore,
      marketImpact: cryptoNewsClusters.marketImpact,
      representativeId: cryptoNewsItems.id,
      representativeTitle: cryptoNewsItems.title,
      representativeUrl: cryptoNewsItems.canonicalUrl,
      representativeSource: cryptoNewsItems.sourceName,
      representativePublishedAt: cryptoNewsItems.publishedAt,
      representativeEventType: cryptoNewsItems.eventType
    })
    .from(cryptoNewsClusters)
    .innerJoin(cryptoNewsItems, eq(cryptoNewsClusters.representativeNewsItemId, cryptoNewsItems.id))
    .where(eq(cryptoNewsClusters.id, clusterId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    clusterId: Number(row.clusterId),
    label: row.label,
    importanceScore: Number(row.importanceScore ?? 0),
    marketImpact: sanitizeMarketImpact(row.marketImpact),
    representativeId: Number(row.representativeId),
    representativeTitle: row.representativeTitle,
    representativeUrl: row.representativeUrl,
    representativeSource: row.representativeSource,
    representativePublishedAt: row.representativePublishedAt,
    representativeEventType: row.representativeEventType
  };
}

async function getClusterNewsItemIds(db: D1Database, clusterId: number, representativeNewsItemId: number): Promise<number[]> {
  const orm = drizzle(db);
  const memberRows = await orm
    .select({
      newsItemId: cryptoNewsClusterMembers.newsItemId
    })
    .from(cryptoNewsClusterMembers)
    .where(eq(cryptoNewsClusterMembers.clusterId, clusterId));

  return Array.from(
    new Set(
      [representativeNewsItemId, ...memberRows.map((row) => Number(row.newsItemId))].filter(
        (value) => Number.isInteger(value) && value > 0
      )
    )
  );
}

async function getClusterNewsItemContext(
  db: D1Database,
  newsItemIds: number[]
): Promise<{
  itemRows: Array<{
    id: number;
    rawId: number;
    title: string;
    canonicalUrl: string;
    sourceName: string;
    sourceType: NewsSourceType;
    publishedAt: string;
    summaryZh: string;
    summaryEn: string;
    eventType: string;
    signalScore: number;
    noiseScore: number;
    confidence: number;
    shouldDisplay: boolean;
    isMarketWide: boolean;
    reason: string;
  }>;
  coinCodesByNewsItemId: Map<number, string[]>;
  topicCodesByNewsItemId: Map<number, string[]>;
  coinCodes: string[];
  topicCodes: string[];
  sourceNames: string[];
}> {
  if (newsItemIds.length === 0) {
    return {
      itemRows: [],
      coinCodesByNewsItemId: new Map<number, string[]>(),
      topicCodesByNewsItemId: new Map<number, string[]>(),
      coinCodes: [],
      topicCodes: [],
      sourceNames: []
    };
  }

  const orm = drizzle(db);
  const [itemRows, coinRows, topicRows] = await Promise.all([
    orm
      .select({
        id: cryptoNewsItems.id,
        rawId: cryptoNewsItems.rawId,
        title: cryptoNewsItems.title,
        canonicalUrl: cryptoNewsItems.canonicalUrl,
        sourceName: cryptoNewsItems.sourceName,
        sourceType: cryptoNewsItems.sourceType,
        publishedAt: cryptoNewsItems.publishedAt,
        summaryZh: cryptoNewsItems.summaryZh,
        summaryEn: cryptoNewsItems.summaryEn,
        eventType: cryptoNewsItems.eventType,
        signalScore: cryptoNewsItems.signalScore,
        noiseScore: cryptoNewsItems.noiseScore,
        confidence: cryptoNewsItems.confidence,
        shouldDisplay: cryptoNewsItems.shouldDisplay,
        isMarketWide: cryptoNewsItems.isMarketWide,
        reason: cryptoNewsItems.reason
      })
      .from(cryptoNewsItems)
      .where(inArray(cryptoNewsItems.id, newsItemIds))
      .orderBy(desc(cryptoNewsItems.publishedAt), desc(cryptoNewsItems.signalScore)),
    orm
      .select({
        newsItemId: cryptoNewsItemCoins.newsItemId,
        coinCode: cryptoNewsItemCoins.coinCode
      })
      .from(cryptoNewsItemCoins)
      .where(inArray(cryptoNewsItemCoins.newsItemId, newsItemIds)),
    orm
      .select({
        newsItemId: cryptoNewsItemTopics.newsItemId,
        topicCode: cryptoNewsItemTopics.topicCode
      })
      .from(cryptoNewsItemTopics)
      .where(inArray(cryptoNewsItemTopics.newsItemId, newsItemIds))
  ]);

  const coinCodesByNewsItemId = new Map<number, string[]>();
  const topicCodesByNewsItemId = new Map<number, string[]>();
  const coinCodeSet = new Set<string>();
  const topicCodeSet = new Set<string>();
  const sourceNameSet = new Set<string>();

  for (const row of itemRows) {
    sourceNameSet.add(row.sourceName);
  }
  for (const row of coinRows) {
    const newsItemId = Number(row.newsItemId);
    const next = coinCodesByNewsItemId.get(newsItemId) ?? [];
    if (!next.includes(row.coinCode)) {
      next.push(row.coinCode);
      coinCodeSet.add(row.coinCode);
    }
    coinCodesByNewsItemId.set(newsItemId, next);
  }
  for (const row of topicRows) {
    const newsItemId = Number(row.newsItemId);
    const next = topicCodesByNewsItemId.get(newsItemId) ?? [];
    if (!next.includes(row.topicCode)) {
      next.push(row.topicCode);
      topicCodeSet.add(row.topicCode);
    }
    topicCodesByNewsItemId.set(newsItemId, next);
  }

  return {
    itemRows: itemRows.map((row) => ({
      ...row,
      id: Number(row.id),
      rawId: Number(row.rawId),
      signalScore: Number(row.signalScore ?? 0),
      noiseScore: Number(row.noiseScore ?? 0),
      confidence: Number(row.confidence ?? 0),
      shouldDisplay: !!row.shouldDisplay,
      isMarketWide: !!row.isMarketWide,
      sourceType: row.sourceType as NewsSourceType
    })),
    coinCodesByNewsItemId,
    topicCodesByNewsItemId,
    coinCodes: [...coinCodeSet],
    topicCodes: [...topicCodeSet],
    sourceNames: [...sourceNameSet]
  };
}

async function getNewsItemTaxonomy(
  db: D1Database,
  newsItemIds: number[]
): Promise<{
  coinCodesByNewsItemId: Map<number, string[]>;
  topicCodesByNewsItemId: Map<number, string[]>;
}> {
  if (newsItemIds.length === 0) {
    return {
      coinCodesByNewsItemId: new Map<number, string[]>(),
      topicCodesByNewsItemId: new Map<number, string[]>()
    };
  }

  const orm = drizzle(db);
  const [coinRows, topicRows] = await Promise.all([
    orm
      .select({
        newsItemId: cryptoNewsItemCoins.newsItemId,
        coinCode: cryptoNewsItemCoins.coinCode
      })
      .from(cryptoNewsItemCoins)
      .where(inArray(cryptoNewsItemCoins.newsItemId, newsItemIds)),
    orm
      .select({
        newsItemId: cryptoNewsItemTopics.newsItemId,
        topicCode: cryptoNewsItemTopics.topicCode
      })
      .from(cryptoNewsItemTopics)
      .where(inArray(cryptoNewsItemTopics.newsItemId, newsItemIds))
  ]);

  const coinCodesByNewsItemId = new Map<number, string[]>();
  const topicCodesByNewsItemId = new Map<number, string[]>();
  for (const row of coinRows) {
    const newsItemId = Number(row.newsItemId);
    const next = coinCodesByNewsItemId.get(newsItemId) ?? [];
    if (!next.includes(row.coinCode)) {
      next.push(row.coinCode);
    }
    coinCodesByNewsItemId.set(newsItemId, next);
  }
  for (const row of topicRows) {
    const newsItemId = Number(row.newsItemId);
    const next = topicCodesByNewsItemId.get(newsItemId) ?? [];
    if (!next.includes(row.topicCode)) {
      next.push(row.topicCode);
    }
    topicCodesByNewsItemId.set(newsItemId, next);
  }

  return {
    coinCodesByNewsItemId,
    topicCodesByNewsItemId
  };
}

async function getNewsItemClusterVisibility(
  db: D1Database,
  newsItemIds: number[]
): Promise<{
  representativeClusterIdByNewsItemId: Map<number, number>;
  clusteredMemberNewsItemIds: Set<number>;
}> {
  if (newsItemIds.length === 0) {
    return {
      representativeClusterIdByNewsItemId: new Map<number, number>(),
      clusteredMemberNewsItemIds: new Set<number>()
    };
  }

  const orm = drizzle(db);
  const [representativeRows, memberRows] = await Promise.all([
    orm
      .select({
        newsItemId: cryptoNewsClusters.representativeNewsItemId,
        clusterId: cryptoNewsClusters.id
      })
      .from(cryptoNewsClusters)
      .where(inArray(cryptoNewsClusters.representativeNewsItemId, newsItemIds)),
    orm
      .select({
        newsItemId: cryptoNewsClusterMembers.newsItemId
      })
      .from(cryptoNewsClusterMembers)
      .where(inArray(cryptoNewsClusterMembers.newsItemId, newsItemIds))
  ]);

  const representativeClusterIdByNewsItemId = new Map<number, number>();
  for (const row of representativeRows) {
    representativeClusterIdByNewsItemId.set(Number(row.newsItemId), Number(row.clusterId));
  }

  const clusteredMemberNewsItemIds = new Set<number>();
  for (const row of memberRows) {
    const newsItemId = Number(row.newsItemId);
    if (!representativeClusterIdByNewsItemId.has(newsItemId)) {
      clusteredMemberNewsItemIds.add(newsItemId);
    }
  }

  return {
    representativeClusterIdByNewsItemId,
    clusteredMemberNewsItemIds
  };
}

function resolveVisibleClusterId(
  newsItemId: number,
  visibility: {
    representativeClusterIdByNewsItemId: Map<number, number>;
    clusteredMemberNewsItemIds: Set<number>;
  }
): number | null | undefined {
  if (visibility.representativeClusterIdByNewsItemId.has(newsItemId)) {
    return visibility.representativeClusterIdByNewsItemId.get(newsItemId) ?? null;
  }
  if (visibility.clusteredMemberNewsItemIds.has(newsItemId)) {
    return undefined;
  }
  return null;
}

function sortClusterNewsItems<
  T extends {
    id: number;
    publishedAt: string;
    signalScore: number;
  }
>(rows: T[], representativeNewsItemId: number): T[] {
  return [...rows].sort((left, right) => {
    if (left.id === representativeNewsItemId && right.id !== representativeNewsItemId) {
      return -1;
    }
    if (right.id === representativeNewsItemId && left.id !== representativeNewsItemId) {
      return 1;
    }
    return right.publishedAt.localeCompare(left.publishedAt) || Number(right.signalScore ?? 0) - Number(left.signalScore ?? 0);
  });
}

async function listEventCoinSnapshots(
  db: D1Database,
  reportDate: string,
  coinCodes: string[]
): Promise<NewsEventCoinSnapshot[]> {
  if (coinCodes.length === 0) {
    return [];
  }

  const orm = drizzle(db);
  const rows = await orm
    .select({
      reportDate: dailyReports.reportDate,
      code: dailyCoinSnapshots.code,
      priceUsdt: dailyCoinSnapshots.priceUsdt,
      change24hPct: dailyCoinSnapshots.change24hPct,
      quoteVolume24hUsdt: dailyCoinSnapshots.quoteVolume24hUsdt,
      tradeSharePct: dailyCoinSnapshots.tradeSharePct
    })
    .from(dailyCoinSnapshots)
    .innerJoin(dailyReports, eq(dailyReports.id, dailyCoinSnapshots.reportId))
    .where(and(eq(dailyReports.reportDate, reportDate), inArray(dailyCoinSnapshots.code, coinCodes)))
    .orderBy(desc(dailyCoinSnapshots.tradeSharePct), asc(dailyCoinSnapshots.code));

  return rows.map((row) => ({
    reportDate: row.reportDate,
    code: row.code,
    priceUsdt: Number(row.priceUsdt ?? 0),
    change24hPct: Number(row.change24hPct ?? 0),
    quoteVolume24hUsdt: Number(row.quoteVolume24hUsdt ?? 0),
    tradeSharePct: Number(row.tradeSharePct ?? 0)
  }));
}

async function listClusterIdsByCoin(db: D1Database, coinCode: string, limit: number): Promise<number[]> {
  const orm = drizzle(db);
  const [representativeRows, memberRows] = await Promise.all([
    orm
      .select({
        clusterId: cryptoNewsClusters.id,
        representativePublishedAt: cryptoNewsItems.publishedAt
      })
      .from(cryptoNewsClusters)
      .innerJoin(cryptoNewsItems, eq(cryptoNewsClusters.representativeNewsItemId, cryptoNewsItems.id))
      .innerJoin(cryptoNewsItemCoins, eq(cryptoNewsItemCoins.newsItemId, cryptoNewsItems.id))
      .where(eq(cryptoNewsItemCoins.coinCode, coinCode))
      .orderBy(desc(cryptoNewsItems.publishedAt))
      .limit(limit),
    orm
      .select({
        clusterId: cryptoNewsClusterMembers.clusterId,
        representativePublishedAt: cryptoNewsItems.publishedAt
      })
      .from(cryptoNewsClusterMembers)
      .innerJoin(cryptoNewsClusters, eq(cryptoNewsClusters.id, cryptoNewsClusterMembers.clusterId))
      .innerJoin(cryptoNewsItems, eq(cryptoNewsClusters.representativeNewsItemId, cryptoNewsItems.id))
      .innerJoin(cryptoNewsItemCoins, eq(cryptoNewsItemCoins.newsItemId, cryptoNewsClusterMembers.newsItemId))
      .where(eq(cryptoNewsItemCoins.coinCode, coinCode))
      .orderBy(desc(cryptoNewsItems.publishedAt))
      .limit(limit)
  ]);

  const merged = [...representativeRows, ...memberRows].sort((left, right) =>
    right.representativePublishedAt.localeCompare(left.representativePublishedAt)
  );
  const orderedClusterIds: number[] = [];
  const seen = new Set<number>();
  for (const row of merged) {
    const clusterId = Number(row.clusterId);
    if (!Number.isInteger(clusterId) || clusterId <= 0 || seen.has(clusterId)) {
      continue;
    }
    seen.add(clusterId);
    orderedClusterIds.push(clusterId);
    if (orderedClusterIds.length >= limit) {
      break;
    }
  }

  return orderedClusterIds;
}

async function listCoinPriceHistoryPoints(
  db: D1Database,
  coinCode: string,
  limit: number
): Promise<Array<{ reportDate: string; priceUsdt: number; change24hPct: number }>> {
  const orm = drizzle(db);
  const rows = await orm
    .select({
      reportDate: dailyReports.reportDate,
      priceUsdt: dailyCoinSnapshots.priceUsdt,
      change24hPct: dailyCoinSnapshots.change24hPct
    })
    .from(dailyCoinSnapshots)
    .innerJoin(dailyReports, eq(dailyReports.id, dailyCoinSnapshots.reportId))
    .where(eq(dailyCoinSnapshots.code, coinCode))
    .orderBy(asc(dailyReports.reportDate))
    .limit(limit);

  return rows.map((row) => ({
    reportDate: row.reportDate,
    priceUsdt: Number(row.priceUsdt ?? 0),
    change24hPct: Number(row.change24hPct ?? 0)
  }));
}

function buildCoinEventReaction(
  priceHistory: Array<{ reportDate: string; priceUsdt: number; change24hPct: number }>,
  reportDate: string
): CoinEventTimelineItem["reaction"] {
  const eventIndex = priceHistory.findIndex((row) => row.reportDate === reportDate);
  const eventRow = eventIndex >= 0 ? priceHistory[eventIndex] : null;
  const basePrice = eventRow?.priceUsdt ?? null;
  const nextRow = eventIndex >= 0 ? priceHistory[eventIndex + 1] ?? null : null;
  const day3Row = eventIndex >= 0 ? priceHistory[eventIndex + 3] ?? null : null;

  return {
    event: {
      reportDate,
      priceUsdt: eventRow?.priceUsdt ?? null,
      change24hPct: eventRow?.change24hPct ?? null,
      returnPct: eventRow ? 0 : null
    },
    next: {
      reportDate: nextRow?.reportDate ?? null,
      priceUsdt: nextRow?.priceUsdt ?? null,
      change24hPct: nextRow?.change24hPct ?? null,
      returnPct: calculateReturnPct(basePrice, nextRow?.priceUsdt ?? null)
    },
    day3: {
      reportDate: day3Row?.reportDate ?? null,
      priceUsdt: day3Row?.priceUsdt ?? null,
      change24hPct: day3Row?.change24hPct ?? null,
      returnPct: calculateReturnPct(basePrice, day3Row?.priceUsdt ?? null)
    }
  };
}

function calculateReturnPct(basePrice: number | null, price: number | null): number | null {
  if (basePrice === null || price === null || basePrice <= 0) {
    return null;
  }
  return Number((((price - basePrice) / basePrice) * 100).toFixed(2));
}

export async function getCryptoNewsAdminOverview(db: D1Database): Promise<CryptoNewsAdminOverview> {
  await ensureCryptoNewsSchema(db);

  const orm = drizzle(db);
  const [rawCountRows, latestRawRows, itemCountRows, latestItemRows] = await Promise.all([
    orm
      .select({
        ingestStatus: cryptoNewsRaw.ingestStatus,
        count: count()
      })
      .from(cryptoNewsRaw)
      .groupBy(cryptoNewsRaw.ingestStatus),
    orm
      .select({
        fetchedAt: cryptoNewsRaw.fetchedAt
      })
      .from(cryptoNewsRaw)
      .orderBy(desc(cryptoNewsRaw.fetchedAt))
      .limit(1),
    orm
      .select({
        shouldDisplay: cryptoNewsItems.shouldDisplay,
        count: count()
      })
      .from(cryptoNewsItems)
      .groupBy(cryptoNewsItems.shouldDisplay),
    orm
      .select({
        publishedAt: cryptoNewsItems.publishedAt
      })
      .from(cryptoNewsItems)
      .orderBy(desc(cryptoNewsItems.publishedAt))
      .limit(1)
  ]);

  const rawCountByStatus = new Map(rawCountRows.map((row) => [row.ingestStatus, Number(row.count ?? 0)]));
  const itemCountByDisplay = new Map(itemCountRows.map((row) => [!!row.shouldDisplay, Number(row.count ?? 0)]));

  return {
    pendingRawCount: rawCountByStatus.get("pending") ?? 0,
    processedRawCount: rawCountByStatus.get("processed") ?? 0,
    rejectedRawCount: rawCountByStatus.get("rejected") ?? 0,
    failedRawCount: rawCountByStatus.get("failed") ?? 0,
    displayItemCount: itemCountByDisplay.get(true) ?? 0,
    hiddenItemCount: itemCountByDisplay.get(false) ?? 0,
    latestFetchedAt: latestRawRows[0]?.fetchedAt ?? null,
    latestPublishedAt: latestItemRows[0]?.publishedAt ?? null
  };
}

export async function listCryptoNewsAdminRaw(
  db: D1Database,
  options: {
    limit: number;
    status?: string | null;
  }
): Promise<CryptoNewsAdminRawItem[]> {
  await ensureCryptoNewsSchema(db);

  const normalizedStatus = sanitizeAdminRawStatus(options.status ?? "");
  const orm = drizzle(db);
  const baseQuery = orm
    .select({
      id: cryptoNewsRaw.id,
      sourceName: cryptoNewsRaw.sourceName,
      sourceType: cryptoNewsRaw.sourceType,
      title: cryptoNewsRaw.title,
      canonicalUrl: cryptoNewsRaw.canonicalUrl,
      publishedAt: cryptoNewsRaw.publishedAt,
      fetchedAt: cryptoNewsRaw.fetchedAt,
      ingestStatus: cryptoNewsRaw.ingestStatus
    })
    .from(cryptoNewsRaw);
  const rows = await (normalizedStatus
    ? baseQuery.where(eq(cryptoNewsRaw.ingestStatus, normalizedStatus)).orderBy(desc(cryptoNewsRaw.publishedAt), desc(cryptoNewsRaw.id)).limit(options.limit)
    : baseQuery.orderBy(desc(cryptoNewsRaw.publishedAt), desc(cryptoNewsRaw.id)).limit(options.limit));

  return rows.map((row) => ({
    id: Number(row.id),
    sourceName: row.sourceName,
    sourceType: row.sourceType as NewsSourceType,
    title: row.title,
    canonicalUrl: row.canonicalUrl,
    publishedAt: row.publishedAt,
    fetchedAt: row.fetchedAt,
    ingestStatus: row.ingestStatus
  }));
}

export async function listCryptoNewsAdminItems(
  db: D1Database,
  options: {
    limit: number;
    displayOnly?: boolean;
  }
): Promise<CryptoNewsAdminCuratedItem[]> {
  await ensureCryptoNewsSchema(db);

  const orm = drizzle(db);
  const baseQuery = orm
    .select({
      id: cryptoNewsItems.id,
      rawId: cryptoNewsItems.rawId,
      title: cryptoNewsItems.title,
      canonicalUrl: cryptoNewsItems.canonicalUrl,
      sourceName: cryptoNewsItems.sourceName,
      publishedAt: cryptoNewsItems.publishedAt,
      relevanceType: cryptoNewsItems.relevanceType,
      eventType: cryptoNewsItems.eventType,
      signalScore: cryptoNewsItems.signalScore,
      noiseScore: cryptoNewsItems.noiseScore,
      confidence: cryptoNewsItems.confidence,
      shouldDisplay: cryptoNewsItems.shouldDisplay,
      isMarketWide: cryptoNewsItems.isMarketWide,
      reason: cryptoNewsItems.reason
    })
    .from(cryptoNewsItems);
  const rows = await (options.displayOnly
    ? baseQuery.where(eq(cryptoNewsItems.shouldDisplay, true)).orderBy(desc(cryptoNewsItems.publishedAt), desc(cryptoNewsItems.id)).limit(options.limit)
    : baseQuery.orderBy(desc(cryptoNewsItems.publishedAt), desc(cryptoNewsItems.id)).limit(options.limit));
  const taxonomy = await getNewsItemTaxonomy(
    db,
    rows.map((row) => Number(row.id))
  );

  return rows.map((row) => ({
    id: Number(row.id),
    rawId: Number(row.rawId),
    title: row.title,
    canonicalUrl: row.canonicalUrl,
    sourceName: row.sourceName,
    publishedAt: row.publishedAt,
    relevanceType: row.relevanceType as RelevanceType,
    eventType: row.eventType as EventType,
    signalScore: Number(row.signalScore ?? 0),
    noiseScore: Number(row.noiseScore ?? 0),
    confidence: Number(row.confidence ?? 0),
    shouldDisplay: !!row.shouldDisplay,
    isMarketWide: !!row.isMarketWide,
    reason: row.reason,
    relatedCoins: taxonomy.coinCodesByNewsItemId.get(Number(row.id)) ?? [],
    topics: taxonomy.topicCodesByNewsItemId.get(Number(row.id)) ?? []
  }));
}

export async function reprocessCryptoNews(
  env: CryptoNewsEnv,
  coins: CoinSeedLike[],
  options: {
    hours: number;
    limit: number;
  }
): Promise<NewsIngestionResult> {
  if (!env.DB) {
    throw new Error("DB binding is required for crypto news reprocessing.");
  }

  await ensureCryptoNewsSchema(env.DB);

  const since = new Date(Date.now() - options.hours * 60 * 60 * 1000).toISOString();
  const orm = drizzle(env.DB);
  const rawRowsBase = await orm
    .select({
      id: cryptoNewsRaw.id,
      sourceName: cryptoNewsRaw.sourceName,
      sourceType: cryptoNewsRaw.sourceType,
      sourceUrl: cryptoNewsRaw.sourceUrl,
      canonicalUrl: cryptoNewsRaw.canonicalUrl,
      title: cryptoNewsRaw.title,
      publishedAt: cryptoNewsRaw.publishedAt,
      fetchedAt: cryptoNewsRaw.fetchedAt,
      rawHash: cryptoNewsRaw.rawHash,
      ingestStatus: cryptoNewsRaw.ingestStatus
    })
    .from(cryptoNewsRaw)
    .where(gte(cryptoNewsRaw.publishedAt, since))
    .orderBy(desc(cryptoNewsRaw.publishedAt), desc(cryptoNewsRaw.id))
    .limit(options.limit);

  const rawRows = rawRowsBase.map((row) => ({
    ...row,
    id: Number(row.id),
    sourceType: row.sourceType as NewsSourceType,
    snippet: null,
    bodyText: null,
    hintCoins: [],
    hintTopics: []
  }));
  const curatedRows = await classifyRawRows(env, rawRows, coins);
  const hydratedRows = await hydrateCuratedSummaries(env, curatedRows);

  for (const curatedRow of hydratedRows) {
    await upsertCuratedNews(env.DB, curatedRow);
  }

  const clusteredCount = await rebuildNewsClusters(env, CLUSTER_LOOKBACK_HOURS);
  const acceptedCount = hydratedRows.filter((row) => row.shouldDisplay).length;

  return {
    fetchedRawCount: rawRows.length,
    processedCount: hydratedRows.length,
    acceptedCount,
    rejectedCount: hydratedRows.length - acceptedCount,
    clusteredCount
  };
}

async function collectNewsCandidates(coins: CoinSeedLike[]): Promise<CandidateNewsItem[]> {
  const directFeedsPromise = Promise.all(DIRECT_FEEDS.map((feed) => fetchFeedCandidates(feed)));
  const googleFeedsPromise = Promise.all(buildGoogleNewsSources(coins).map((feed) => fetchFeedCandidates(feed)));
  const [directFeeds, googleFeeds] = await Promise.all([directFeedsPromise, googleFeedsPromise]);
  const candidates = [...directFeeds.flat(), ...googleFeeds.flat()];
  return candidates.filter((candidate) => isWithinLookback(candidate.publishedAt, NEWS_LOOKBACK_HOURS));
}

async function fetchFeedCandidates(
  source:
    | FeedSource
    | (FeedSource & {
        hintCoins?: string[];
        hintTopics?: string[];
      })
): Promise<CandidateNewsItem[]> {
  let timeoutHandle: number | undefined;
  const controller = new AbortController();
  try {
    timeoutHandle = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS) as unknown as number;
    const response = await fetch(source.url, {
      headers: {
        accept: "application/rss+xml, application/xml, text/xml, text/html",
        "user-agent": "Mozilla/5.0"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const parsedItems = parseFeed(xml);
    const fetchedAt = new Date().toISOString();
    return parsedItems.slice(0, source.itemLimit).map((item) => {
      const title = sanitizeParagraph(item.title);
      const canonicalUrl = normalizeUrl(item.link);
      const snippet = item.snippet ? sanitizeParagraph(item.snippet) : null;
      return {
        sourceName: source.name,
        sourceType: source.sourceType,
        sourceUrl: source.url,
        canonicalUrl,
        title,
        snippet,
        bodyText: null,
        publishedAt: item.publishedAt.toISOString(),
        fetchedAt,
        rawHash: buildRawHash(title, canonicalUrl),
        hintCoins: "hintCoins" in source && source.hintCoins ? [...source.hintCoins] : [],
        hintTopics: "hintTopics" in source && source.hintTopics ? [...source.hintTopics] : []
      };
    });
  } catch {
    return [];
  } finally {
    if (typeof timeoutHandle === "number") {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildGoogleNewsSources(coins: CoinSeedLike[]): Array<FeedSource & { hintCoins?: string[]; hintTopics?: string[] }> {
  const out: Array<FeedSource & { hintCoins?: string[]; hintTopics?: string[] }> = [
    {
      name: "Google News",
      sourceType: "aggregator",
      url: buildGoogleNewsUrl("cryptocurrency market OR bitcoin ETF OR stablecoin regulation"),
      itemLimit: GOOGLE_NEWS_ITEM_LIMIT,
      hintTopics: ["macro", "regulation", "etf", "stablecoin"]
    }
  ];

  for (const coin of coins) {
    out.push({
      name: "Google News",
      sourceType: "aggregator",
      url: buildGoogleNewsUrl(buildCoinNewsQuery(coin.code, coin.nameEn)),
      itemLimit: GOOGLE_NEWS_ITEM_LIMIT,
      hintCoins: [coin.code]
    });
  }

  return out;
}

function buildGoogleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function buildCoinNewsQuery(code: string, nameEn: string): string {
  switch (code) {
    case "BTC":
      return "Bitcoin OR BTC crypto OR spot bitcoin ETF";
    case "ETH":
      return "Ethereum OR Ether OR ETH crypto OR spot ether ETF";
    case "USDC":
      return "USDC OR USD Coin OR Circle stablecoin";
    case "SOL":
      return "Solana OR SOL crypto";
    case "XRP":
      return "XRP OR Ripple crypto";
    case "FDUSD":
      return "FDUSD OR First Digital USD stablecoin";
    case "DOGE":
      return "Dogecoin OR DOGE crypto";
    case "BNB":
      return "BNB OR Binance Coin OR BNB Chain";
    case "SUI":
      return "Sui OR Sui Network crypto";
    case "TRUMP":
      return "\"Official Trump\" token OR TRUMP meme coin crypto OR TRUMP Solana token";
    default:
      return `${nameEn} OR ${code} crypto`;
  }
}

function parseFeed(xml: string): Array<{
  title: string;
  link: string;
  snippet: string | null;
  publishedAt: Date;
}> {
  if (/<entry[\s>]/i.test(xml)) {
    return parseAtomFeed(xml);
  }
  return parseRssFeed(xml);
}

function parseRssFeed(
  xml: string
): Array<{
  title: string;
  link: string;
  snippet: string | null;
  publishedAt: Date;
}> {
  const itemRegex = /<item\b[\s\S]*?>([\s\S]*?)<\/item>/gi;
  const out: Array<{
    title: string;
    link: string;
    snippet: string | null;
    publishedAt: Date;
  }> = [];
  let match = itemRegex.exec(xml);

  while (match) {
    const block = match[1];
    const title = htmlDecode(extractTag(block, "title"));
    const link = htmlDecode(extractTag(block, "link"));
    const description = extractTag(block, "description") || extractTag(block, "content:encoded");
    const pubDateRaw = htmlDecode(extractTag(block, "pubDate"));
    const publishedAt = new Date(pubDateRaw);

    if (title && link && !Number.isNaN(publishedAt.getTime())) {
      out.push({
        title,
        link,
        snippet: description ? sanitizeParagraph(htmlDecode(stripHtmlTags(description))) : null,
        publishedAt
      });
    }

    match = itemRegex.exec(xml);
  }

  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

function parseAtomFeed(
  xml: string
): Array<{
  title: string;
  link: string;
  snippet: string | null;
  publishedAt: Date;
}> {
  const entryRegex = /<entry\b[\s\S]*?>([\s\S]*?)<\/entry>/gi;
  const out: Array<{
    title: string;
    link: string;
    snippet: string | null;
    publishedAt: Date;
  }> = [];
  let match = entryRegex.exec(xml);

  while (match) {
    const block = match[1];
    const title = htmlDecode(extractTag(block, "title"));
    const linkTag = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
    const link = htmlDecode(linkTag?.[1] ?? extractTag(block, "link"));
    const summary = extractTag(block, "summary") || extractTag(block, "content");
    const publishedRaw = htmlDecode(extractTag(block, "published") || extractTag(block, "updated"));
    const publishedAt = new Date(publishedRaw);

    if (title && link && !Number.isNaN(publishedAt.getTime())) {
      out.push({
        title,
        link,
        snippet: summary ? sanitizeParagraph(htmlDecode(stripHtmlTags(summary))) : null,
        publishedAt
      });
    }

    match = entryRegex.exec(xml);
  }

  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

function dedupeCandidates(candidates: CandidateNewsItem[]): CandidateNewsItem[] {
  const seen = new Set<string>();
  const out: CandidateNewsItem[] = [];

  for (const candidate of candidates.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const key = candidate.rawHash || `${normalizeTitle(candidate.title)}|${candidate.canonicalUrl}`;
    if (!candidate.title || !candidate.canonicalUrl || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(candidate);
  }

  return out;
}

async function persistRawCandidates(db: D1Database, candidates: CandidateNewsItem[]): Promise<RawNewsRow[]> {
  const out: RawNewsRow[] = [];
  const orm = drizzle(db);

  for (const candidate of candidates) {
    await orm
      .insert(cryptoNewsRaw)
      .values({
        sourceName: candidate.sourceName,
        sourceType: candidate.sourceType,
        sourceUrl: candidate.sourceUrl,
        canonicalUrl: candidate.canonicalUrl,
        title: candidate.title,
        publishedAt: candidate.publishedAt,
        fetchedAt: candidate.fetchedAt,
        rawHash: candidate.rawHash,
        ingestStatus: "pending"
      })
      .onConflictDoUpdate({
        target: cryptoNewsRaw.rawHash,
        set: {
          sourceName: candidate.sourceName,
          sourceType: candidate.sourceType,
          sourceUrl: candidate.sourceUrl,
          canonicalUrl: candidate.canonicalUrl,
          title: candidate.title,
          fetchedAt: candidate.fetchedAt,
          publishedAt: candidate.publishedAt
        }
      });
    const rows = await orm
      .select({
        id: cryptoNewsRaw.id,
        ingestStatus: cryptoNewsRaw.ingestStatus
      })
      .from(cryptoNewsRaw)
      .where(eq(cryptoNewsRaw.rawHash, candidate.rawHash))
      .limit(1);
    const inserted = rows[0];

    out.push({
      ...candidate,
      id: Number(inserted?.id ?? 0),
      ingestStatus: inserted?.ingestStatus ?? "pending"
    });
  }

  return out;
}

async function classifyRawRows(env: CryptoNewsEnv, rawRows: RawNewsRow[], coins: CoinSeedLike[]): Promise<CuratedNewsRecord[]> {
  if (rawRows.length === 0) {
    return [];
  }

  const out: CuratedNewsRecord[] = [];
  const batches = chunk(rawRows, CLASSIFICATION_BATCH_SIZE);

  for (const batch of batches) {
    const classified = await classifyBatchWithAi(env, batch, coins);
    const byRawId = new Map(classified.map((item) => [item.rawId, item]));

    for (const rawRow of batch) {
      out.push(byRawId.get(rawRow.id) ?? fallbackClassifyRawRow(rawRow, coins));
    }
  }

  return out;
}

function shouldDeepReadForSummary(row: CuratedNewsRecord): boolean {
  if (!row.shouldDisplay) {
    return false;
  }
  if (row.sourceType === "official") {
    return true;
  }
  if (row.isMarketWide) {
    return true;
  }
  return row.signalScore >= 55 || row.confidence < 0.7;
}

async function summarizeWithDeepBody(
  env: CryptoNewsEnv,
  row: CuratedNewsRecord,
  bodyText: string
): Promise<{ summaryZh: string; summaryEn: string } | null> {
  if (!env.AI) {
    return null;
  }

  const promptPayload = {
    title: row.title,
    sourceName: row.sourceName,
    publishedAt: row.publishedAt,
    relatedCoins: row.relatedCoins,
    marketTopics: row.marketTopics,
    eventType: row.eventType,
    bodyText: truncateByChars(bodyText, BODY_FETCH_MAX_CHARS)
  };

  const responseText = await requestAiText(env, {
    systemPrompt:
      "You are a crypto news summarizer. Return strict JSON only with keys summaryZh and summaryEn. Use only the supplied article excerpt and metadata. Be factual, concise, and avoid investment advice.",
    userPrompt: JSON.stringify(promptPayload, null, 2),
    maxTokens: 420
  });

  if (!responseText) {
    return null;
  }

  const parsed = parseAiJson<{ summaryZh?: string; summaryEn?: string }>(responseText);
  const summaryZh = sanitizeParagraph(parsed?.summaryZh ?? "");
  const summaryEn = sanitizeParagraph(parsed?.summaryEn ?? "");
  if (!summaryZh && !summaryEn) {
    return null;
  }

  return {
    summaryZh: summaryZh || row.summaryZh,
    summaryEn: summaryEn || row.summaryEn
  };
}

async function classifyBatchWithAi(env: CryptoNewsEnv, rawRows: RawNewsRow[], coins: CoinSeedLike[]): Promise<CuratedNewsRecord[]> {
  if (!env.AI) {
    return rawRows.map((row) => fallbackClassifyRawRow(row, coins));
  }

  const allowedCoins = coins.map((coin) => coin.code).join(", ");
  const promptPayload = rawRows.map((row) => ({
    rawId: row.id,
    title: row.title,
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    publishedAt: row.publishedAt,
    snippet: truncateByChars(row.snippet ?? "", 280),
    hintCoins: row.hintCoins,
    hintTopics: row.hintTopics
  }));

  const responseText = await requestAiText(env, {
    systemPrompt:
      "You are a crypto news curator. Return strict JSON only. Classify each candidate for relevance to tracked coins and to the overall crypto market. Favor factual, high-signal items. Reject price-prediction, opinion, recap, and low-information content. The tracked coins are: " +
      allowedCoins +
      ". Allowed relevanceType values: coin, market, coin_and_market, irrelevant. Allowed eventType values: announcement, listing, delisting, partnership, lawsuit, regulation, hack, exploit, network_upgrade, etf_flow, reserve_update, funding, adoption. Allowed marketTopics values: regulation, etf, stablecoin, exchange, security, macro, infrastructure, liquidity. Return an object with key items. Each item must include rawId, isRelevant, relevanceType, relatedCoins, isMarketWide, marketTopics, eventType, signalScore, noiseScore, confidence, shouldDisplay, reason, summaryZh, summaryEn.",
    userPrompt: JSON.stringify({ items: promptPayload }, null, 2),
    maxTokens: 1800
  });

  if (!responseText) {
    return rawRows.map((row) => fallbackClassifyRawRow(row, coins));
  }

  const parsed = parseAiJson<{ items?: Array<Record<string, unknown>> }>(responseText);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  if (items.length === 0) {
    return rawRows.map((row) => fallbackClassifyRawRow(row, coins));
  }

  const coinSet = new Set(coins.map((coin) => coin.code));
  return items
    .map((item) => {
      const rawId = Number(item.rawId ?? 0);
      const rawRow = rawRows.find((row) => row.id === rawId);
      if (!rawRow) {
        return null;
      }
      return sanitizeCuratedRecord(item, rawRow, coinSet);
    })
    .filter((item): item is CuratedNewsRecord => !!item);
}

function sanitizeCuratedRecord(item: Record<string, unknown>, rawRow: RawNewsRow, allowedCoins: Set<string>): CuratedNewsRecord {
  const hardRejected = containsTrumpButMissingCryptoContext(rawRow);
  const relatedCoins = sanitizeCoinCodes(item.relatedCoins, allowedCoins, rawRow.hintCoins);
  const relevanceType = sanitizeRelevanceType(item.relevanceType, relatedCoins.length > 0, toBoolean(item.isMarketWide));
  const marketTopics = sanitizeTopicCodes(item.marketTopics, rawRow.hintTopics);
  const isRelevant = hardRejected ? false : toBoolean(item.isRelevant) || relevanceType !== "irrelevant";
  const isMarketWide = !hardRejected && (toBoolean(item.isMarketWide) || relevanceType === "market" || relevanceType === "coin_and_market");
  const signalScore = clampInt(item.signalScore, 0, 100, relatedCoins.length > 0 || isMarketWide ? 60 : 10);
  const noiseScore = clampInt(item.noiseScore, 0, 100, 30);
  const confidence = clampNumber(item.confidence, 0, 1, 0.55);
  const shouldDisplay =
    !hardRejected &&
    isRelevant &&
    toBoolean(item.shouldDisplay) &&
    signalScore >= 35 &&
    noiseScore <= 80 &&
    confidence >= 0.3;
  const summaryZh = sanitizeParagraph(asString(item.summaryZh)) || buildFallbackSummaryZh(rawRow.title);
  const summaryEn = sanitizeParagraph(asString(item.summaryEn)) || buildFallbackSummaryEn(rawRow.title);
  const reason =
    sanitizeParagraph(asString(item.reason)) ||
    (hardRejected ? "Rejected by the TRUMP crypto-context guard." : shouldDisplay ? "High-signal crypto item." : "Filtered as lower-signal or not directly relevant.");

  return {
    rawId: rawRow.id,
    title: rawRow.title,
    canonicalUrl: rawRow.canonicalUrl,
    sourceName: rawRow.sourceName,
    sourceType: rawRow.sourceType,
    publishedAt: rawRow.publishedAt,
    summaryZh,
    summaryEn,
    relevanceType: hardRejected ? "irrelevant" : relevanceType,
    eventType: sanitizeEventType(item.eventType, rawRow),
    signalScore,
    noiseScore,
    confidence,
    shouldDisplay,
    isMarketWide: shouldDisplay ? isMarketWide : false,
    reason,
    relatedCoins: shouldDisplay || relatedCoins.length > 0 ? relatedCoins : [],
    marketTopics: marketTopics
  };
}

function fallbackClassifyRawRow(rawRow: RawNewsRow, coins: CoinSeedLike[]): CuratedNewsRecord {
  const haystack = `${rawRow.title}\n${rawRow.snippet ?? ""}\n${rawRow.bodyText ?? ""}`.toLowerCase();
  const relatedCoins = detectRelatedCoins(haystack, coins, rawRow.hintCoins);
  const isMarketWide = isMarketWideText(haystack) || rawRow.hintTopics.length > 0;
  const eventType = detectEventType(haystack);
  const noiseScore = detectNoiseScore(haystack);
  const signalScore = clampInt(
    baseSignalScore(rawRow.sourceType) +
      (isMarketWide ? 10 : 0) +
      (relatedCoins.length > 0 ? 8 : 0) +
      (eventType === "regulation" || eventType === "hack" || eventType === "etf_flow" ? 12 : 0) -
      Math.floor(noiseScore / 3),
    0,
    100,
    40
  );
  const isRelevant = !containsTrumpButMissingCryptoContext(rawRow) && (relatedCoins.length > 0 || isMarketWide);
  const shouldDisplay = isRelevant && signalScore >= 40 && noiseScore <= 65;

  return {
    rawId: rawRow.id,
    title: rawRow.title,
    canonicalUrl: rawRow.canonicalUrl,
    sourceName: rawRow.sourceName,
    sourceType: rawRow.sourceType,
    publishedAt: rawRow.publishedAt,
    summaryZh: buildFallbackSummaryZh(rawRow.title),
    summaryEn: buildFallbackSummaryEn(rawRow.title),
    relevanceType: !isRelevant ? "irrelevant" : relatedCoins.length > 0 && isMarketWide ? "coin_and_market" : relatedCoins.length > 0 ? "coin" : "market",
    eventType,
    signalScore,
    noiseScore,
    confidence: isRelevant ? 0.55 : 0.25,
    shouldDisplay,
    isMarketWide: shouldDisplay && isMarketWide,
    reason: shouldDisplay ? "Fallback heuristics kept this crypto item." : "Fallback heuristics filtered this item.",
    relatedCoins,
    marketTopics: detectTopics(haystack, rawRow.hintTopics)
  };
}

async function upsertCuratedNews(db: D1Database, record: CuratedNewsRecord): Promise<void> {
  const orm = drizzle(db);
  const updatedAt = new Date().toISOString();
  await orm
    .insert(cryptoNewsItems)
    .values({
      rawId: record.rawId,
      title: record.title,
      canonicalUrl: record.canonicalUrl,
      sourceName: record.sourceName,
      sourceType: record.sourceType,
      publishedAt: record.publishedAt,
      summaryZh: record.summaryZh,
      summaryEn: record.summaryEn,
      relevanceType: record.relevanceType,
      eventType: record.eventType,
      signalScore: record.signalScore,
      noiseScore: record.noiseScore,
      confidence: record.confidence,
      shouldDisplay: record.shouldDisplay,
      isMarketWide: record.isMarketWide,
      reason: record.reason,
      updatedAt
    })
    .onConflictDoUpdate({
      target: cryptoNewsItems.rawId,
      set: {
        title: record.title,
        canonicalUrl: record.canonicalUrl,
        sourceName: record.sourceName,
        sourceType: record.sourceType,
        publishedAt: record.publishedAt,
        summaryZh: record.summaryZh,
        summaryEn: record.summaryEn,
        relevanceType: record.relevanceType,
        eventType: record.eventType,
        signalScore: record.signalScore,
        noiseScore: record.noiseScore,
        confidence: record.confidence,
        shouldDisplay: record.shouldDisplay,
        isMarketWide: record.isMarketWide,
        reason: record.reason,
        updatedAt
      }
    });

  const row = await orm
    .select({
      id: cryptoNewsItems.id
    })
    .from(cryptoNewsItems)
    .where(eq(cryptoNewsItems.rawId, record.rawId))
    .limit(1);
  const newsItemId = Number(row[0]?.id ?? 0);

  if (!newsItemId) {
    await updateRawIngestStatus(db, record.rawId, "failed");
    return;
  }

  await orm.delete(cryptoNewsItemCoins).where(eq(cryptoNewsItemCoins.newsItemId, newsItemId));
  await orm.delete(cryptoNewsItemTopics).where(eq(cryptoNewsItemTopics.newsItemId, newsItemId));

  for (const [index, coinCode] of record.relatedCoins.entries()) {
    await orm
      .insert(cryptoNewsItemCoins)
      .values({
        newsItemId,
        coinCode,
        relationConfidence: record.confidence,
        isPrimary: index === 0
      })
      .onConflictDoUpdate({
        target: [cryptoNewsItemCoins.newsItemId, cryptoNewsItemCoins.coinCode],
        set: {
          relationConfidence: record.confidence,
          isPrimary: index === 0
        }
      });
  }

  for (const topicCode of record.marketTopics) {
    await orm
      .insert(cryptoNewsItemTopics)
      .values({
        newsItemId,
        topicCode
      })
      .onConflictDoNothing();
  }

  await updateRawIngestStatus(db, record.rawId, record.shouldDisplay ? "processed" : "rejected");
}

async function updateRawIngestStatus(db: D1Database, rawId: number, status: string): Promise<void> {
  const orm = drizzle(db);
  await orm.update(cryptoNewsRaw).set({ ingestStatus: status }).where(eq(cryptoNewsRaw.id, rawId));
}

async function rebuildNewsClusters(env: CryptoNewsEnv, hours: number): Promise<number> {
  if (!env.DB) {
    return 0;
  }

  const orm = drizzle(env.DB);
  const candidates = await listClusterInputs(env.DB, hours);
  await orm.delete(cryptoNewsClusterMembers);
  await orm.delete(cryptoNewsClusters);

  if (candidates.length === 0) {
    return 0;
  }

  const clusters = await clusterCuratedItems(env, candidates);

  for (const cluster of clusters) {
    const clusterKey = cluster.clusterId || buildClusterKey(cluster.clusterLabel, cluster.representativeNewsId);
    await orm.insert(cryptoNewsClusters).values({
      clusterKey,
      clusterLabel: cluster.clusterLabel,
      representativeNewsItemId: cluster.representativeNewsId,
      importanceScore: cluster.importanceScore,
      marketImpact: cluster.marketImpact,
      updatedAt: new Date().toISOString()
    });

    const clusterRow = await orm
      .select({
        id: cryptoNewsClusters.id
      })
      .from(cryptoNewsClusters)
      .where(eq(cryptoNewsClusters.clusterKey, clusterKey))
      .limit(1);
    const clusterId = Number(clusterRow[0]?.id ?? 0);
    if (!clusterId) {
      continue;
    }

    for (const memberNewsId of cluster.memberNewsIds) {
      await orm
        .insert(cryptoNewsClusterMembers)
        .values({
          clusterId,
          newsItemId: memberNewsId
        })
        .onConflictDoNothing();
    }
  }

  return clusters.length;
}

async function listClusterInputs(db: D1Database, hours: number): Promise<ClusterInputItem[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const orm = drizzle(db);
  const rows = await orm
    .select({
      id: cryptoNewsItems.id,
      title: cryptoNewsItems.title,
      sourceName: cryptoNewsItems.sourceName,
      publishedAt: cryptoNewsItems.publishedAt,
      summaryZh: cryptoNewsItems.summaryZh,
      summaryEn: cryptoNewsItems.summaryEn,
      signalScore: cryptoNewsItems.signalScore
    })
    .from(cryptoNewsItems)
    .where(and(eq(cryptoNewsItems.shouldDisplay, true), gte(cryptoNewsItems.publishedAt, since)))
    .orderBy(desc(cryptoNewsItems.publishedAt), desc(cryptoNewsItems.signalScore))
    .limit(60);
  const taxonomy = await getNewsItemTaxonomy(
    db,
    rows.map((row) => Number(row.id))
  );

  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    sourceName: row.sourceName,
    publishedAt: row.publishedAt,
    summaryZh: row.summaryZh,
    summaryEn: row.summaryEn,
    relatedCoins: taxonomy.coinCodesByNewsItemId.get(Number(row.id)) ?? [],
    marketTopics: taxonomy.topicCodesByNewsItemId.get(Number(row.id)) ?? [],
    signalScore: Number(row.signalScore ?? 0)
  }));
}

async function clusterCuratedItems(env: CryptoNewsEnv, items: ClusterInputItem[]): Promise<ClusterRecord[]> {
  if (!env.AI) {
    return buildFallbackClusters(items);
  }

  const responseText = await requestAiText(env, {
    systemPrompt:
      "You are a crypto news deduplication engine. Return strict JSON only. Group only items that describe the same underlying event. Use the given ids. Return an object with key clusters. Each cluster must include clusterId, clusterLabel, representativeNewsId, memberNewsIds, importanceScore, marketImpact, duplicateConfidence. Allowed marketImpact values: low, medium, high. Prefer one cluster per event and do not force unrelated stories together.",
    userPrompt: JSON.stringify(
      {
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          sourceName: item.sourceName,
          publishedAt: item.publishedAt,
          summaryZh: item.summaryZh,
          relatedCoins: item.relatedCoins,
          marketTopics: item.marketTopics,
          signalScore: item.signalScore
        }))
      },
      null,
      2
    ),
    maxTokens: 1800
  });

  if (!responseText) {
    return buildFallbackClusters(items);
  }

  const parsed = parseAiJson<{ clusters?: Array<Record<string, unknown>> }>(responseText);
  const clusters = Array.isArray(parsed?.clusters) ? parsed.clusters : [];
  if (clusters.length === 0) {
    return buildFallbackClusters(items);
  }

  const itemIds = new Set(items.map((item) => item.id));
  const sanitized = clusters
    .map((cluster) => sanitizeClusterRecord(cluster, itemIds))
    .filter((cluster): cluster is ClusterRecord => !!cluster);

  return sanitized.length > 0 ? sanitized : buildFallbackClusters(items);
}

function sanitizeClusterRecord(cluster: Record<string, unknown>, itemIds: Set<number>): ClusterRecord | null {
  const rawMemberIds = Array.isArray(cluster.memberNewsIds) ? cluster.memberNewsIds.map((value) => Number(value)).filter((value) => itemIds.has(value)) : [];
  if (rawMemberIds.length === 0) {
    return null;
  }
  const memberNewsIds = [...new Set(rawMemberIds)];
  const representativeCandidate = Number(cluster.representativeNewsId ?? 0);
  const representativeNewsId = memberNewsIds.includes(representativeCandidate) ? representativeCandidate : memberNewsIds[0];
  const clusterLabel = sanitizeParagraph(asString(cluster.clusterLabel)) || `Cluster ${representativeNewsId}`;

  return {
    clusterId: sanitizeParagraph(asString(cluster.clusterId)) || buildClusterKey(clusterLabel, representativeNewsId),
    clusterLabel,
    representativeNewsId,
    memberNewsIds,
    importanceScore: clampInt(cluster.importanceScore, 0, 100, 50),
    marketImpact: sanitizeMarketImpact(cluster.marketImpact)
  };
}

function buildFallbackClusters(items: ClusterInputItem[]): ClusterRecord[] {
  const grouped = new Map<string, ClusterInputItem[]>();

  for (const item of items) {
    const key = normalizeTitle(item.title);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  return [...grouped.values()].map((group) => {
    const sorted = [...group].sort((a, b) => b.signalScore - a.signalScore || b.publishedAt.localeCompare(a.publishedAt));
    const representative = sorted[0];
    return {
      clusterId: buildClusterKey(representative.title, representative.id),
      clusterLabel: representative.title,
      representativeNewsId: representative.id,
      memberNewsIds: group.map((item) => item.id),
      importanceScore: clampInt(Math.round(sorted.reduce((sum, item) => sum + item.signalScore, 0) / sorted.length), 0, 100, 50),
      marketImpact: sorted.some((item) => item.marketTopics.includes("regulation") || item.marketTopics.includes("security")) ? "high" : group.length > 1 ? "medium" : "low"
    };
  });
}

async function requestAiText(
  env: CryptoNewsEnv,
  input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
  }
): Promise<string | null> {
  if (!env.AI) {
    return null;
  }

  try {
    const payload = await Promise.race([
      env.AI.run(NEWS_AI_MODEL, {
        messages: [
          {
            role: "system",
            content: input.systemPrompt
          },
          {
            role: "user",
            content: input.userPrompt
          }
        ],
        max_tokens: input.maxTokens,
        temperature: 0.2
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out after ${AI_REQUEST_TIMEOUT_MS}ms`)), AI_REQUEST_TIMEOUT_MS);
      })
    ]);
    return extractAiText(payload);
  } catch (error) {
    console.error(`Crypto news AI request failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function extractAiText(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload.trim() || null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const candidate of [record.output_text, record.response, record.result, record.text]) {
    const extracted = extractAiText(candidate);
    if (extracted) {
      return extracted;
    }
  }

  const output = record.output;
  if (Array.isArray(output)) {
    const text = output
      .flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }
        const itemRecord = item as Record<string, unknown>;
        if (typeof itemRecord.text === "string") {
          return [itemRecord.text];
        }
        const content = itemRecord.content;
        if (!Array.isArray(content)) {
          return [];
        }
        return content
          .map((part) => {
            if (!part || typeof part !== "object") {
              return null;
            }
            const textPart = (part as Record<string, unknown>).text;
            return typeof textPart === "string" ? textPart : null;
          })
          .filter((value): value is string => !!value);
      })
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];
    if (firstChoice && typeof firstChoice === "object") {
      const message = (firstChoice as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string" && content.trim()) {
          return content.trim();
        }
      }
    }
  }

  return null;
}

function parseAiJson<T>(value: string): T | null {
  const direct = safeJsonParse<T>(value);
  if (direct) {
    return direct;
  }

  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    const fenced = safeJsonParse<T>(fencedMatch[1].trim());
    if (fenced) {
      return fenced;
    }
  }

  const objectStart = value.indexOf("{");
  const objectEnd = value.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const objectValue = safeJsonParse<T>(value.slice(objectStart, objectEnd + 1));
    if (objectValue) {
      return objectValue;
    }
  }

  return null;
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function sanitizeCoinCodes(input: unknown, allowedCoins: Set<string>, fallbackCoins: string[]): string[] {
  const values = Array.isArray(input) ? input : [];
  const out = values
    .map((value) => String(value).trim().toUpperCase())
    .filter((value) => allowedCoins.has(value));

  if (out.length > 0) {
    return [...new Set(out)];
  }

  return fallbackCoins.filter((value) => allowedCoins.has(value));
}

function sanitizeTopicCodes(input: unknown, fallbackTopics: string[]): string[] {
  const values = Array.isArray(input) ? input : [];
  const out = values.map((value) => sanitizeTopicCode(String(value))).filter((value): value is string => !!value);
  const merged = [...out, ...fallbackTopics.map((value) => sanitizeTopicCode(value)).filter((value): value is string => !!value)];
  return [...new Set(merged)];
}

function sanitizeTopicCode(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return (TOPIC_CODES as readonly string[]).includes(normalized) ? normalized : null;
}

function sanitizeAdminRawStatus(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return ["pending", "processed", "rejected", "failed"].includes(normalized) ? normalized : null;
}

function sanitizeRelevanceType(value: unknown, hasCoins: boolean, isMarketWide: boolean): RelevanceType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if ((RELEVANCE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as RelevanceType;
  }
  if (hasCoins && isMarketWide) {
    return "coin_and_market";
  }
  if (hasCoins) {
    return "coin";
  }
  if (isMarketWide) {
    return "market";
  }
  return "irrelevant";
}

function sanitizeEventType(value: unknown, rawRow: RawNewsRow): EventType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if ((EVENT_TYPES as readonly string[]).includes(normalized)) {
    return normalized as EventType;
  }
  return detectEventType(`${rawRow.title}\n${rawRow.snippet ?? ""}\n${rawRow.bodyText ?? ""}`.toLowerCase());
}

function sanitizeMarketImpact(value: unknown): MarketImpact {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (MARKET_IMPACTS as readonly string[]).includes(normalized) ? (normalized as MarketImpact) : "medium";
}

function containsTrumpButMissingCryptoContext(rawRow: RawNewsRow): boolean {
  const combined = `${rawRow.title} ${rawRow.snippet ?? ""} ${rawRow.bodyText ?? ""}`.toLowerCase();
  if (!combined.includes("trump")) {
    return false;
  }
  const maybeTrumpCoin = rawRow.hintCoins.includes("TRUMP") || /\bofficial trump\b/i.test(rawRow.title) || /\btrump\b/i.test(rawRow.title);
  if (!maybeTrumpCoin) {
    return false;
  }
  return !/\b(token|coin|crypto|cryptocurrency|meme coin|memecoin|solana|digital asset|blockchain)\b/i.test(combined);
}

function detectRelatedCoins(haystack: string, coins: CoinSeedLike[], hints: string[]): string[] {
  return detectMappedCoins(
    haystack,
    coins.map((coin) => coin.code),
    hints
  );
}

function isMarketWideText(haystack: string): boolean {
  return /\b(crypto market|cryptocurrency market|digital asset market|bitcoin etf|stablecoin|exchange|federal reserve|sec|cftc|hack|exploit|liquidity)\b/i.test(
    haystack
  );
}

function detectEventType(haystack: string): EventType {
  if (/\b(listing|listed|lists|launchpool)\b/i.test(haystack)) {
    return "listing";
  }
  if (/\b(delist|delisting|remove trading pair)\b/i.test(haystack)) {
    return "delisting";
  }
  if (/\b(hack|hacked|security breach)\b/i.test(haystack)) {
    return "hack";
  }
  if (/\b(exploit|drain(ed)?|vulnerability)\b/i.test(haystack)) {
    return "exploit";
  }
  if (/\b(sec|cftc|regulation|regulator|license|licence|mica|compliance)\b/i.test(haystack)) {
    return "regulation";
  }
  if (/\b(etf|fund flow|net inflow|net outflow)\b/i.test(haystack)) {
    return "etf_flow";
  }
  if (/\b(reserve|attestation|mint(ed)?|redeem(ed)?)\b/i.test(haystack)) {
    return "reserve_update";
  }
  if (/\b(partnership|collaboration|integrat(e|ion)|alliance)\b/i.test(haystack)) {
    return "partnership";
  }
  if (/\b(lawsuit|court|settlement|legal)\b/i.test(haystack)) {
    return "lawsuit";
  }
  if (/\b(upgrade|hard fork|mainnet|validator|network update)\b/i.test(haystack)) {
    return "network_upgrade";
  }
  if (/\b(funding|raise|raised|backed)\b/i.test(haystack)) {
    return "funding";
  }
  if (/\b(adoption|payment|settlement|integration|treasury)\b/i.test(haystack)) {
    return "adoption";
  }
  return "announcement";
}

function detectTopics(haystack: string, hints: string[]): string[] {
  const out = new Set<string>(hints.map((value) => sanitizeTopicCode(value)).filter((value): value is string => !!value));
  if (/\b(sec|cftc|regulation|regulator|license|compliance|mica)\b/i.test(haystack)) {
    out.add("regulation");
  }
  if (/\betf\b/i.test(haystack)) {
    out.add("etf");
  }
  if (/\bstablecoin|usdc|fdusd|reserve|attestation|mint|redeem\b/i.test(haystack)) {
    out.add("stablecoin");
  }
  if (/\b(binance|coinbase|kraken|exchange|listing|delisting)\b/i.test(haystack)) {
    out.add("exchange");
  }
  if (/\bhack|exploit|breach|vulnerability\b/i.test(haystack)) {
    out.add("security");
  }
  if (/\bfederal reserve|rates|macro|risk appetite|liquidity\b/i.test(haystack)) {
    out.add("macro");
    out.add("liquidity");
  }
  if (/\b(mainnet|validator|network|bridge|rollup|chain|upgrade)\b/i.test(haystack)) {
    out.add("infrastructure");
  }
  return [...out];
}

function detectNoiseScore(haystack: string): number {
  let score = 20;
  if (/\b(price prediction|forecast|analyst says|opinion|commentary|what to know|recap)\b/i.test(haystack)) {
    score += 35;
  }
  if (/\b(may|could|might)\b/i.test(haystack)) {
    score += 10;
  }
  if (/\b(watch these|top picks|best crypto|bull run)\b/i.test(haystack)) {
    score += 20;
  }
  return Math.min(100, score);
}

function baseSignalScore(sourceType: NewsSourceType): number {
  switch (sourceType) {
    case "official":
      return 78;
    case "media":
      return 68;
    case "aggregator":
      return 56;
    default:
      return 50;
  }
}

function buildFallbackSummaryZh(title: string): string {
  return `相关新闻摘要：${sanitizeParagraph(title)}`;
}

function buildFallbackSummaryEn(title: string): string {
  return `Related crypto news: ${sanitizeParagraph(title)}`;
}

async function fetchNewsBodySnippet(
  url: string,
  options: { timeoutMs: number; maxChars: number }
): Promise<string | null> {
  let timeoutHandle: number | undefined;
  const controller = new AbortController();

  try {
    timeoutHandle = setTimeout(() => controller.abort(), options.timeoutMs) as unknown as number;
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    const html = await response.text();
    return extractNewsBodySnippetFromHtml(html, options.maxChars);
  } catch {
    return null;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function extractNewsBodySnippetFromHtml(html: string, maxChars: number): string | null {
  const readabilityText = extractReadabilityText(html);
  if (readabilityText && !isLowValueSnippet(readabilityText)) {
    return truncateByChars(readabilityText, maxChars);
  }

  const metaDescription = extractMetaDescription(html);
  if (metaDescription && !isLowValueSnippet(metaDescription)) {
    return truncateByChars(metaDescription, maxChars);
  }

  const articleText = extractArticleText(html);
  if (articleText && !isLowValueSnippet(articleText)) {
    return truncateByChars(articleText, maxChars);
  }

  const paragraphText = extractParagraphText(html);
  if (paragraphText && !isLowValueSnippet(paragraphText)) {
    return truncateByChars(paragraphText, maxChars);
  }

  return null;
}

function extractReadabilityText(html: string): string | null {
  try {
    const { document } = parseHTML(html);
    const parsed = new Readability(document as never).parse();
    const content = sanitizeParagraph(parsed?.textContent ?? "");
    return content || null;
  } catch {
    return null;
  }
}

function extractMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+content\s*=\s*["']([\s\S]*?)["'][^>]+(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const content = sanitizeParagraph(htmlDecode(stripHtmlTags(match?.[1] ?? "")));
    if (content) {
      return content;
    }
  }

  return null;
}

function extractArticleText(html: string): string | null {
  const match = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!match) {
    return null;
  }
  const content = sanitizeParagraph(htmlDecode(stripHtmlTags(match[1])));
  return content || null;
}

function extractParagraphText(html: string): string | null {
  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paragraphMatches.length === 0) {
    return null;
  }

  const joined = paragraphMatches
    .slice(0, 12)
    .map((match) => sanitizeParagraph(htmlDecode(stripHtmlTags(match[1]))))
    .filter((text) => text.length > 40)
    .slice(0, 6)
    .join(" ");

  return joined || null;
}

function isLowValueSnippet(input: string): boolean {
  const normalized = input.toLowerCase();
  if (!normalized || normalized.length < 40) {
    return true;
  }
  if (normalized.includes("comprehensive up-to-date news coverage") && normalized.includes("google news")) {
    return true;
  }
  return false;
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function extractTag(input: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = input.match(regex);
  return match?.[1]?.trim() ?? "";
}

function htmlDecode(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_full, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_full, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.trim().toLowerCase();
      if (TRACKING_PARAMS.has(normalizedKey) || normalizedKey.startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}

function buildRawHash(title: string, canonicalUrl: string): string {
  return `${normalizeTitle(title)}|${canonicalUrl}`;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+-\s+[^-]+$/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeParagraph(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || String(value).trim().toLowerCase() === "true";
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function splitCsv(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function truncateByChars(input: string, maxChars: number): string {
  const normalized = sanitizeParagraph(input);
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return normalized.slice(0, maxChars).trimEnd() + "...";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      out[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

function isWithinLookback(isoString: string, hours: number): boolean {
  const timestamp = Date.parse(isoString);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  return timestamp >= Date.now() - hours * 60 * 60 * 1000;
}

function buildClusterKey(label: string, representativeNewsId: number): string {
  const normalized = normalizeTitle(label) || `cluster-${representativeNewsId}`;
  return `${normalized}-${representativeNewsId}`;
}

function getReportDateWindow(reportDate: string): { startIso: string; endIso: string } {
  const startIso = new Date(`${reportDate}T00:00:00.000Z`).toISOString();
  const endDate = new Date(startIso);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return {
    startIso,
    endIso: endDate.toISOString()
  };
}

function formatIsoDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "1970-01-01";
  }
  return new Date(timestamp).toISOString().slice(0, 10);
}

function deriveNewsStance(eventType: string, topics: string[], title: string): NewsStance {
  const bearishEventTypes = new Set(["delisting", "lawsuit", "hack", "exploit"]);
  const bullishEventTypes = new Set(["listing", "partnership", "network_upgrade", "etf_flow", "reserve_update", "funding", "adoption"]);
  if (bearishEventTypes.has(eventType)) {
    return "bearish";
  }
  if (bullishEventTypes.has(eventType)) {
    return "bullish";
  }

  if (topics.includes("security")) {
    return "bearish";
  }
  if (topics.includes("liquidity") || topics.includes("infrastructure")) {
    return "bullish";
  }

  const normalizedTitle = title.toLowerCase();
  if (/(hack|exploit|lawsuit|outflow|probe|breach|liquidat)/.test(normalizedTitle)) {
    return "bearish";
  }
  if (/(approval|launch|partnership|funding|inflow|adoption|upgrade)/.test(normalizedTitle)) {
    return "bullish";
  }

  return "neutral";
}

async function attachClusterAssociationScores(
  db: D1Database,
  reportDate: string,
  clusters: NewsClusterListItem[]
): Promise<NewsClusterListItem[]> {
  if (clusters.length === 0) {
    return clusters;
  }

  const orm = drizzle(db);
  const snapshotRows = await orm
    .select({
      code: dailyCoinSnapshots.code,
      change24hPct: dailyCoinSnapshots.change24hPct
    })
    .from(dailyCoinSnapshots)
    .innerJoin(dailyReports, eq(dailyReports.id, dailyCoinSnapshots.reportId))
    .where(eq(dailyReports.reportDate, reportDate));

  const changeByCode = new Map<string, number>();
  let marketMoveAbsMax = 0;
  for (const row of snapshotRows) {
    const change = Number(row.change24hPct ?? 0);
    changeByCode.set(row.code, change);
    marketMoveAbsMax = Math.max(marketMoveAbsMax, Math.abs(change));
  }

  return clusters.map((cluster) => {
    const relatedChanges = cluster.relatedCoins
      .map((coinCode) => changeByCode.get(coinCode))
      .filter((value): value is number => typeof value === "number");

    const moveAnchor = relatedChanges.length > 0 ? Math.max(...relatedChanges.map((value) => Math.abs(value))) : marketMoveAbsMax;
    const directionalAverage =
      relatedChanges.length > 0 ? relatedChanges.reduce((sum, value) => sum + value, 0) / relatedChanges.length : 0;
    const directionBonus =
      cluster.stance === "bullish" && directionalAverage > 0
        ? 10
        : cluster.stance === "bearish" && directionalAverage < 0
          ? 10
          : cluster.stance === "neutral"
            ? 4
            : 0;
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(cluster.importanceScore * 0.58 + Math.min(22, moveAnchor * 2.5) + Math.min(12, cluster.sourceCount * 3) + directionBonus)
      )
    );

    return {
      ...cluster,
      associationScore: score
    };
  });
}

async function getCoinNewsByCodeForWindow(
  db: D1Database,
  options: {
    startIso: string;
    endIso: string;
    limitPerCoin: number;
  }
): Promise<Record<string, CoinNewsItem[]>> {
  const orm = drizzle(db);
  const rows = await orm
    .select({
      coinCode: cryptoNewsItemCoins.coinCode,
      id: cryptoNewsItems.id,
      title: cryptoNewsItems.title,
      url: cryptoNewsItems.canonicalUrl,
      source: cryptoNewsItems.sourceName,
      publishedAt: cryptoNewsItems.publishedAt,
      summaryZh: cryptoNewsItems.summaryZh,
      summaryEn: cryptoNewsItems.summaryEn,
      eventType: cryptoNewsItems.eventType,
      signalScore: cryptoNewsItems.signalScore,
      isPrimary: cryptoNewsItemCoins.isPrimary
    })
    .from(cryptoNewsItems)
    .innerJoin(cryptoNewsItemCoins, eq(cryptoNewsItemCoins.newsItemId, cryptoNewsItems.id))
    .where(
      and(
        eq(cryptoNewsItems.shouldDisplay, true),
        gte(cryptoNewsItems.publishedAt, options.startIso),
        lt(cryptoNewsItems.publishedAt, options.endIso)
      )
    )
    .orderBy(asc(cryptoNewsItemCoins.coinCode), desc(cryptoNewsItems.publishedAt), desc(cryptoNewsItems.signalScore));
  const visibility = await getNewsItemClusterVisibility(
    db,
    rows.map((row) => Number(row.id))
  );

  const out: Record<string, CoinNewsItem[]> = {};
  for (const row of rows) {
    const id = Number(row.id);
    const clusterId = resolveVisibleClusterId(id, visibility);
    if (typeof clusterId === "undefined") {
      continue;
    }

    const bucket = out[row.coinCode] ?? [];
    if (bucket.length >= options.limitPerCoin) {
      continue;
    }
    bucket.push({
      id,
      title: row.title,
      url: row.url,
      source: row.source,
      publishedAt: row.publishedAt,
      summaryZh: row.summaryZh,
      summaryEn: row.summaryEn,
      eventType: row.eventType,
      stance: deriveNewsStance(row.eventType, [], row.title),
      signalScore: Number(row.signalScore ?? 0),
      isPrimary: !!row.isPrimary,
      clusterId
    });
    out[row.coinCode] = bucket;
  }

  return out;
}
