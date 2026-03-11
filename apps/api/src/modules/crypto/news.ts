import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

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

export type NewsClusterListItem = {
  clusterId: number;
  label: string;
  importanceScore: number;
  marketImpact: MarketImpact;
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
  const topicClause = normalizedTopic
    ? "AND EXISTS (SELECT 1 FROM crypto_news_item_topics t2 WHERE t2.news_item_id = n.id AND t2.topic_code = ?)"
    : "";
  const endClause = options.endIso ? "AND n.published_at < ?" : "";
  const statement = `
    SELECT
      n.id AS id,
      n.title AS title,
      n.canonical_url AS url,
      n.source_name AS source,
      n.published_at AS publishedAt,
      n.summary_zh AS summaryZh,
      n.summary_en AS summaryEn,
      n.event_type AS eventType,
      n.signal_score AS signalScore,
      c.id AS clusterId,
      GROUP_CONCAT(DISTINCT t.topic_code) AS topicsCsv
    FROM crypto_news_items n
    LEFT JOIN crypto_news_item_topics t ON t.news_item_id = n.id
    LEFT JOIN crypto_news_cluster_members cm ON cm.news_item_id = n.id
    LEFT JOIN crypto_news_clusters c ON c.id = cm.cluster_id
    WHERE n.should_display = 1
      AND n.is_market_wide = 1
      AND n.published_at >= ?
      ${endClause}
      ${topicClause}
      AND (c.id IS NULL OR c.representative_news_item_id = n.id)
    GROUP BY n.id
    ORDER BY n.published_at DESC, n.signal_score DESC
    LIMIT ?
  `;

  const bindings: Array<string | number> = [options.startIso];
  if (options.endIso) {
    bindings.push(options.endIso);
  }
  if (normalizedTopic) {
    bindings.push(normalizedTopic);
  }
  bindings.push(options.limit);
  const result = await db.prepare(statement).bind(...bindings).all<{
    id: number;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    summaryZh: string;
    summaryEn: string;
    eventType: string;
    signalScore: number;
    clusterId: number | null;
    topicsCsv: string | null;
  }>();

  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    title: row.title,
    url: row.url,
    source: row.source,
    publishedAt: row.publishedAt,
    summaryZh: row.summaryZh,
    summaryEn: row.summaryEn,
    topics: splitCsv(row.topicsCsv),
    eventType: row.eventType,
    signalScore: Number(row.signalScore ?? 0),
    clusterId: row.clusterId ? Number(row.clusterId) : null
  }));
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
  const endClause = options.endIso ? "AND n.published_at < ?" : "";
  const result = await db
    .prepare(
      `
      SELECT
        n.id AS id,
        n.title AS title,
        n.canonical_url AS url,
        n.source_name AS source,
        n.published_at AS publishedAt,
        n.summary_zh AS summaryZh,
        n.summary_en AS summaryEn,
        n.event_type AS eventType,
        n.signal_score AS signalScore,
        MAX(ic.is_primary) AS isPrimary,
        c.id AS clusterId
      FROM crypto_news_items n
      INNER JOIN crypto_news_item_coins ic ON ic.news_item_id = n.id
      LEFT JOIN crypto_news_cluster_members cm ON cm.news_item_id = n.id
      LEFT JOIN crypto_news_clusters c ON c.id = cm.cluster_id
      WHERE n.should_display = 1
        AND ic.coin_code = ?
        AND n.published_at >= ?
        ${endClause}
        AND (c.id IS NULL OR c.representative_news_item_id = n.id)
      GROUP BY n.id
      ORDER BY n.published_at DESC, n.signal_score DESC
      LIMIT ?
      `
    )
    .bind(...(options.endIso ? [coinCode, options.startIso, options.endIso, options.limit] : [coinCode, options.startIso, options.limit]))
    .all<{
      id: number;
      title: string;
      url: string;
      source: string;
      publishedAt: string;
      summaryZh: string;
      summaryEn: string;
      eventType: string;
      signalScore: number;
      isPrimary: number | boolean;
      clusterId: number | null;
    }>();

  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    title: row.title,
    url: row.url,
    source: row.source,
    publishedAt: row.publishedAt,
    summaryZh: row.summaryZh,
    summaryEn: row.summaryEn,
    eventType: row.eventType,
    signalScore: Number(row.signalScore ?? 0),
    isPrimary: !!row.isPrimary,
    clusterId: row.clusterId ? Number(row.clusterId) : null
  }));
}

export async function listRecentNewsClusters(
  db: D1Database,
  options: {
    limit: number;
    hours: number;
  }
): Promise<NewsClusterListItem[]> {
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
  const endClause = options.endIso ? "AND n.published_at < ?" : "";
  const result = await db
    .prepare(
      `
      SELECT
        c.id AS clusterId,
        c.cluster_label AS label,
        c.importance_score AS importanceScore,
        c.market_impact AS marketImpact,
        n.id AS representativeId,
        n.title AS representativeTitle,
        n.canonical_url AS representativeUrl,
        n.source_name AS representativeSource,
        n.published_at AS representativePublishedAt,
        GROUP_CONCAT(DISTINCT ic.coin_code) AS relatedCoinsCsv,
        GROUP_CONCAT(DISTINCT t.topic_code) AS topicsCsv,
        COUNT(DISTINCT m.source_name) AS sourceCount
      FROM crypto_news_clusters c
      INNER JOIN crypto_news_items n ON n.id = c.representative_news_item_id
      LEFT JOIN crypto_news_cluster_members cm ON cm.cluster_id = c.id
      LEFT JOIN crypto_news_items m ON m.id = cm.news_item_id
      LEFT JOIN crypto_news_item_coins ic ON ic.news_item_id = n.id
      LEFT JOIN crypto_news_item_topics t ON t.news_item_id = n.id
      WHERE n.published_at >= ?
      ${endClause}
      GROUP BY c.id
      ORDER BY c.importance_score DESC, n.published_at DESC
      LIMIT ?
      `
    )
    .bind(...(options.endIso ? [options.startIso, options.endIso, options.limit] : [options.startIso, options.limit]))
    .all<{
      clusterId: number;
      label: string;
      importanceScore: number;
      marketImpact: MarketImpact;
      representativeId: number;
      representativeTitle: string;
      representativeUrl: string;
      representativeSource: string;
      representativePublishedAt: string;
      relatedCoinsCsv: string | null;
      topicsCsv: string | null;
      sourceCount: number;
    }>();

  return (result.results ?? []).map((row) => ({
    clusterId: Number(row.clusterId),
    label: row.label,
    importanceScore: Number(row.importanceScore ?? 0),
    marketImpact: sanitizeMarketImpact(row.marketImpact),
    representative: {
      id: Number(row.representativeId),
      title: row.representativeTitle,
      url: row.representativeUrl,
      source: row.representativeSource,
      publishedAt: row.representativePublishedAt
    },
    relatedCoins: splitCsv(row.relatedCoinsCsv),
    topics: splitCsv(row.topicsCsv),
    sourceCount: Number(row.sourceCount ?? 0)
  }));
}

export async function getReportDateNewsSnapshot(db: D1Database, reportDate: string): Promise<ReportDateNewsSnapshot> {
  const { startIso, endIso } = getReportDateWindow(reportDate);
  const [marketNews, clusters, coinNewsByCode] = await Promise.all([
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
    marketNews,
    clusters,
    coinNewsByCode
  };
}

export async function getCryptoNewsAdminOverview(db: D1Database): Promise<CryptoNewsAdminOverview> {
  const [rawStats, itemStats] = await Promise.all([
    db
      .prepare(
        `
        SELECT
          SUM(CASE WHEN ingest_status = 'pending' THEN 1 ELSE 0 END) AS pendingRawCount,
          SUM(CASE WHEN ingest_status = 'processed' THEN 1 ELSE 0 END) AS processedRawCount,
          SUM(CASE WHEN ingest_status = 'rejected' THEN 1 ELSE 0 END) AS rejectedRawCount,
          SUM(CASE WHEN ingest_status = 'failed' THEN 1 ELSE 0 END) AS failedRawCount,
          MAX(fetched_at) AS latestFetchedAt
        FROM crypto_news_raw
        `
      )
      .first<{
        pendingRawCount: number | null;
        processedRawCount: number | null;
        rejectedRawCount: number | null;
        failedRawCount: number | null;
        latestFetchedAt: string | null;
      }>(),
    db
      .prepare(
        `
        SELECT
          SUM(CASE WHEN should_display = 1 THEN 1 ELSE 0 END) AS displayItemCount,
          SUM(CASE WHEN should_display = 0 THEN 1 ELSE 0 END) AS hiddenItemCount,
          MAX(published_at) AS latestPublishedAt
        FROM crypto_news_items
        `
      )
      .first<{
        displayItemCount: number | null;
        hiddenItemCount: number | null;
        latestPublishedAt: string | null;
      }>()
  ]);

  return {
    pendingRawCount: Number(rawStats?.pendingRawCount ?? 0),
    processedRawCount: Number(rawStats?.processedRawCount ?? 0),
    rejectedRawCount: Number(rawStats?.rejectedRawCount ?? 0),
    failedRawCount: Number(rawStats?.failedRawCount ?? 0),
    displayItemCount: Number(itemStats?.displayItemCount ?? 0),
    hiddenItemCount: Number(itemStats?.hiddenItemCount ?? 0),
    latestFetchedAt: rawStats?.latestFetchedAt ?? null,
    latestPublishedAt: itemStats?.latestPublishedAt ?? null
  };
}

export async function listCryptoNewsAdminRaw(
  db: D1Database,
  options: {
    limit: number;
    status?: string | null;
  }
): Promise<CryptoNewsAdminRawItem[]> {
  const normalizedStatus = sanitizeAdminRawStatus(options.status ?? "");
  const statusClause = normalizedStatus ? "WHERE ingest_status = ?" : "";
  const result = await db
    .prepare(
      `
      SELECT
        id AS id,
        source_name AS sourceName,
        source_type AS sourceType,
        title AS title,
        canonical_url AS canonicalUrl,
        published_at AS publishedAt,
        fetched_at AS fetchedAt,
        ingest_status AS ingestStatus
      FROM crypto_news_raw
      ${statusClause}
      ORDER BY published_at DESC, id DESC
      LIMIT ?
      `
    )
    .bind(...(normalizedStatus ? [normalizedStatus, options.limit] : [options.limit]))
    .all<CryptoNewsAdminRawItem>();

  return result.results ?? [];
}

export async function listCryptoNewsAdminItems(
  db: D1Database,
  options: {
    limit: number;
    displayOnly?: boolean;
  }
): Promise<CryptoNewsAdminCuratedItem[]> {
  const displayClause = options.displayOnly ? "WHERE n.should_display = 1" : "";
  const result = await db
    .prepare(
      `
      SELECT
        n.id AS id,
        n.raw_id AS rawId,
        n.title AS title,
        n.canonical_url AS canonicalUrl,
        n.source_name AS sourceName,
        n.published_at AS publishedAt,
        n.relevance_type AS relevanceType,
        n.event_type AS eventType,
        n.signal_score AS signalScore,
        n.noise_score AS noiseScore,
        n.confidence AS confidence,
        n.should_display AS shouldDisplay,
        n.is_market_wide AS isMarketWide,
        n.reason AS reason,
        GROUP_CONCAT(DISTINCT ic.coin_code) AS relatedCoinsCsv,
        GROUP_CONCAT(DISTINCT t.topic_code) AS topicsCsv
      FROM crypto_news_items n
      LEFT JOIN crypto_news_item_coins ic ON ic.news_item_id = n.id
      LEFT JOIN crypto_news_item_topics t ON t.news_item_id = n.id
      ${displayClause}
      GROUP BY n.id
      ORDER BY n.published_at DESC, n.id DESC
      LIMIT ?
      `
    )
    .bind(options.limit)
    .all<{
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
      shouldDisplay: number | boolean;
      isMarketWide: number | boolean;
      reason: string;
      relatedCoinsCsv: string | null;
      topicsCsv: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    rawId: Number(row.rawId),
    title: row.title,
    canonicalUrl: row.canonicalUrl,
    sourceName: row.sourceName,
    publishedAt: row.publishedAt,
    relevanceType: row.relevanceType,
    eventType: row.eventType,
    signalScore: Number(row.signalScore ?? 0),
    noiseScore: Number(row.noiseScore ?? 0),
    confidence: Number(row.confidence ?? 0),
    shouldDisplay: !!row.shouldDisplay,
    isMarketWide: !!row.isMarketWide,
    reason: row.reason,
    relatedCoins: splitCsv(row.relatedCoinsCsv),
    topics: splitCsv(row.topicsCsv)
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

  const since = new Date(Date.now() - options.hours * 60 * 60 * 1000).toISOString();
  const rawRowsResult = await env.DB
    .prepare(
      `
      SELECT
        id AS id,
        source_name AS sourceName,
        source_type AS sourceType,
        source_url AS sourceUrl,
        canonical_url AS canonicalUrl,
        title AS title,
        published_at AS publishedAt,
        fetched_at AS fetchedAt,
        raw_hash AS rawHash,
        ingest_status AS ingestStatus
      FROM crypto_news_raw
      WHERE published_at >= ?
      ORDER BY published_at DESC, id DESC
      LIMIT ?
      `
    )
    .bind(since, options.limit)
    .all<RawNewsRow>();

  const rawRows = (rawRowsResult.results ?? []).map((row) => ({
    ...row,
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

  for (const candidate of candidates) {
    const existing = await db
      .prepare(
        `
        SELECT
          id AS id,
          source_name AS sourceName,
          source_type AS sourceType,
          source_url AS sourceUrl,
          canonical_url AS canonicalUrl,
          title AS title,
          published_at AS publishedAt,
          fetched_at AS fetchedAt,
          raw_hash AS rawHash,
          ingest_status AS ingestStatus
        FROM crypto_news_raw
        WHERE raw_hash = ?
        LIMIT 1
        `
      )
      .bind(candidate.rawHash)
      .first<RawNewsRow>();

    if (existing) {
      await db
        .prepare(
          `
          UPDATE crypto_news_raw
          SET
            source_name = ?,
            source_type = ?,
            source_url = ?,
            canonical_url = ?,
            title = ?,
            fetched_at = ?,
            published_at = ?
          WHERE id = ?
          `
        )
        .bind(
          candidate.sourceName,
          candidate.sourceType,
          candidate.sourceUrl,
          candidate.canonicalUrl,
          candidate.title,
          candidate.fetchedAt,
          candidate.publishedAt,
          existing.id
        )
        .run();

      out.push({
        ...candidate,
        id: Number(existing.id),
        ingestStatus: existing.ingestStatus
      });
      continue;
    }

    await db
      .prepare(
        `
        INSERT INTO crypto_news_raw (
          source_name,
          source_type,
          source_url,
          canonical_url,
          title,
          published_at,
          fetched_at,
          raw_hash,
          ingest_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `
      )
      .bind(
        candidate.sourceName,
        candidate.sourceType,
        candidate.sourceUrl,
        candidate.canonicalUrl,
        candidate.title,
        candidate.publishedAt,
        candidate.fetchedAt,
        candidate.rawHash
      )
      .run();

    const inserted = await db
      .prepare(
        `
        SELECT
          id AS id,
          ingest_status AS ingestStatus
        FROM crypto_news_raw
        WHERE raw_hash = ?
        LIMIT 1
        `
      )
      .bind(candidate.rawHash)
      .first<{ id: number; ingestStatus: string }>();

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
  await db
    .prepare(
      `
      INSERT INTO crypto_news_items (
        raw_id,
        title,
        canonical_url,
        source_name,
        source_type,
        published_at,
        summary_zh,
        summary_en,
        relevance_type,
        event_type,
        signal_score,
        noise_score,
        confidence,
        should_display,
        is_market_wide,
        reason,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(raw_id) DO UPDATE SET
        title = excluded.title,
        canonical_url = excluded.canonical_url,
        source_name = excluded.source_name,
        source_type = excluded.source_type,
        published_at = excluded.published_at,
        summary_zh = excluded.summary_zh,
        summary_en = excluded.summary_en,
        relevance_type = excluded.relevance_type,
        event_type = excluded.event_type,
        signal_score = excluded.signal_score,
        noise_score = excluded.noise_score,
        confidence = excluded.confidence,
        should_display = excluded.should_display,
        is_market_wide = excluded.is_market_wide,
        reason = excluded.reason,
        updated_at = CURRENT_TIMESTAMP
      `
    )
    .bind(
      record.rawId,
      record.title,
      record.canonicalUrl,
      record.sourceName,
      record.sourceType,
      record.publishedAt,
      record.summaryZh,
      record.summaryEn,
      record.relevanceType,
      record.eventType,
      record.signalScore,
      record.noiseScore,
      record.confidence,
      record.shouldDisplay ? 1 : 0,
      record.isMarketWide ? 1 : 0,
      record.reason
    )
    .run();

  const row = await db
    .prepare("SELECT id FROM crypto_news_items WHERE raw_id = ? LIMIT 1")
    .bind(record.rawId)
    .first<{ id: number }>();
  const newsItemId = Number(row?.id ?? 0);

  if (!newsItemId) {
    await updateRawIngestStatus(db, record.rawId, "failed");
    return;
  }

  await db.prepare("DELETE FROM crypto_news_item_coins WHERE news_item_id = ?").bind(newsItemId).run();
  await db.prepare("DELETE FROM crypto_news_item_topics WHERE news_item_id = ?").bind(newsItemId).run();

  for (const [index, coinCode] of record.relatedCoins.entries()) {
    await db
      .prepare(
        `
        INSERT INTO crypto_news_item_coins (news_item_id, coin_code, relation_confidence, is_primary)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(news_item_id, coin_code) DO UPDATE SET
          relation_confidence = excluded.relation_confidence,
          is_primary = excluded.is_primary
        `
      )
      .bind(newsItemId, coinCode, record.confidence, index === 0 ? 1 : 0)
      .run();
  }

  for (const topicCode of record.marketTopics) {
    await db
      .prepare(
        `
        INSERT INTO crypto_news_item_topics (news_item_id, topic_code)
        VALUES (?, ?)
        ON CONFLICT(news_item_id, topic_code) DO NOTHING
        `
      )
      .bind(newsItemId, topicCode)
      .run();
  }

  await updateRawIngestStatus(db, record.rawId, record.shouldDisplay ? "processed" : "rejected");
}

async function updateRawIngestStatus(db: D1Database, rawId: number, status: string): Promise<void> {
  await db.prepare("UPDATE crypto_news_raw SET ingest_status = ? WHERE id = ?").bind(status, rawId).run();
}

async function rebuildNewsClusters(env: CryptoNewsEnv, hours: number): Promise<number> {
  if (!env.DB) {
    return 0;
  }

  const candidates = await listClusterInputs(env.DB, hours);
  await env.DB.prepare("DELETE FROM crypto_news_cluster_members").run();
  await env.DB.prepare("DELETE FROM crypto_news_clusters").run();

  if (candidates.length === 0) {
    return 0;
  }

  const clusters = await clusterCuratedItems(env, candidates);

  for (const cluster of clusters) {
    const clusterKey = cluster.clusterId || buildClusterKey(cluster.clusterLabel, cluster.representativeNewsId);
    await env.DB
      .prepare(
        `
        INSERT INTO crypto_news_clusters (
          cluster_key,
          cluster_label,
          representative_news_item_id,
          importance_score,
          market_impact,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `
      )
      .bind(clusterKey, cluster.clusterLabel, cluster.representativeNewsId, cluster.importanceScore, cluster.marketImpact)
      .run();

    const clusterRow = await env.DB
      .prepare("SELECT id FROM crypto_news_clusters WHERE cluster_key = ? LIMIT 1")
      .bind(clusterKey)
      .first<{ id: number }>();
    const clusterId = Number(clusterRow?.id ?? 0);
    if (!clusterId) {
      continue;
    }

    for (const memberNewsId of cluster.memberNewsIds) {
      await env.DB
        .prepare(
          `
          INSERT INTO crypto_news_cluster_members (cluster_id, news_item_id)
          VALUES (?, ?)
          ON CONFLICT(cluster_id, news_item_id) DO NOTHING
          `
        )
        .bind(clusterId, memberNewsId)
        .run();
    }
  }

  return clusters.length;
}

async function listClusterInputs(db: D1Database, hours: number): Promise<ClusterInputItem[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const result = await db
    .prepare(
      `
      SELECT
        n.id AS id,
        n.title AS title,
        n.source_name AS sourceName,
        n.published_at AS publishedAt,
        n.summary_zh AS summaryZh,
        n.summary_en AS summaryEn,
        n.signal_score AS signalScore,
        GROUP_CONCAT(DISTINCT ic.coin_code) AS relatedCoinsCsv,
        GROUP_CONCAT(DISTINCT t.topic_code) AS marketTopicsCsv
      FROM crypto_news_items n
      LEFT JOIN crypto_news_item_coins ic ON ic.news_item_id = n.id
      LEFT JOIN crypto_news_item_topics t ON t.news_item_id = n.id
      WHERE n.should_display = 1
        AND n.published_at >= ?
      GROUP BY n.id
      ORDER BY n.published_at DESC, n.signal_score DESC
      LIMIT 60
      `
    )
    .bind(since)
    .all<{
      id: number;
      title: string;
      sourceName: string;
      publishedAt: string;
      summaryZh: string;
      summaryEn: string;
      signalScore: number;
      relatedCoinsCsv: string | null;
      marketTopicsCsv: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    title: row.title,
    sourceName: row.sourceName,
    publishedAt: row.publishedAt,
    summaryZh: row.summaryZh,
    summaryEn: row.summaryEn,
    relatedCoins: splitCsv(row.relatedCoinsCsv),
    marketTopics: splitCsv(row.marketTopicsCsv),
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
  const aliases = new Map<string, string[]>([
    ["BTC", ["bitcoin", " btc ", "spot bitcoin etf"]],
    ["ETH", ["ethereum", " ether ", " eth ", "spot ether etf"]],
    ["USDC", ["usdc", "usd coin", "circle stablecoin", "circle"]],
    ["SOL", ["solana", " sol "]],
    ["XRP", ["xrp", "ripple"]],
    ["FDUSD", ["fdusd", "first digital usd", "first digital"]],
    ["DOGE", ["dogecoin", " doge "]],
    ["BNB", ["bnb", "binance coin", "bnb chain", "binance ecosystem"]],
    ["SUI", ["sui", "sui network"]],
    ["TRUMP", ["official trump", "trump token", "trump meme coin", "trump crypto"]]
  ]);

  const out = new Set<string>(hints);

  for (const coin of coins) {
    const values = aliases.get(coin.code) ?? [coin.nameEn.toLowerCase(), coin.code.toLowerCase()];
    if (
      values.some((alias) => haystack.includes(alias.trim())) &&
      (coin.code !== "TRUMP" || /\b(token|coin|crypto|solana|meme)\b/i.test(haystack))
    ) {
      out.add(coin.code);
    }
  }

  return [...out];
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

async function getCoinNewsByCodeForWindow(
  db: D1Database,
  options: {
    startIso: string;
    endIso: string;
    limitPerCoin: number;
  }
): Promise<Record<string, CoinNewsItem[]>> {
  const result = await db
    .prepare(
      `
      SELECT
        ic.coin_code AS coinCode,
        n.id AS id,
        n.title AS title,
        n.canonical_url AS url,
        n.source_name AS source,
        n.published_at AS publishedAt,
        n.summary_zh AS summaryZh,
        n.summary_en AS summaryEn,
        n.event_type AS eventType,
        n.signal_score AS signalScore,
        ic.is_primary AS isPrimary,
        c.id AS clusterId
      FROM crypto_news_items n
      INNER JOIN crypto_news_item_coins ic ON ic.news_item_id = n.id
      LEFT JOIN crypto_news_cluster_members cm ON cm.news_item_id = n.id
      LEFT JOIN crypto_news_clusters c ON c.id = cm.cluster_id
      WHERE n.should_display = 1
        AND n.published_at >= ?
        AND n.published_at < ?
        AND (c.id IS NULL OR c.representative_news_item_id = n.id)
      ORDER BY ic.coin_code ASC, n.published_at DESC, n.signal_score DESC
      `
    )
    .bind(options.startIso, options.endIso)
    .all<{
      coinCode: string;
      id: number;
      title: string;
      url: string;
      source: string;
      publishedAt: string;
      summaryZh: string;
      summaryEn: string;
      eventType: string;
      signalScore: number;
      isPrimary: number | boolean;
      clusterId: number | null;
    }>();

  const out: Record<string, CoinNewsItem[]> = {};
  for (const row of result.results ?? []) {
    const bucket = out[row.coinCode] ?? [];
    if (bucket.length >= options.limitPerCoin) {
      continue;
    }
    bucket.push({
      id: Number(row.id),
      title: row.title,
      url: row.url,
      source: row.source,
      publishedAt: row.publishedAt,
      summaryZh: row.summaryZh,
      summaryEn: row.summaryEn,
      eventType: row.eventType,
      signalScore: Number(row.signalScore ?? 0),
      isPrimary: !!row.isPrimary,
      clusterId: row.clusterId ? Number(row.clusterId) : null
    });
    out[row.coinCode] = bucket;
  }

  return out;
}
