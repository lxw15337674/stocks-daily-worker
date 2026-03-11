import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const coins = sqliteTable(
  "coins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rank: integer("rank").notNull(),
    code: text("code").notNull(),
    pair: text("pair").notNull(),
    nameZh: text("name_zh").notNull(),
    nameEn: text("name_en").notNull(),
    corePositionZh: text("core_position_zh").notNull(),
    corePositionEn: text("core_position_en").notNull(),
    annualQuoteVolumeUsdt: real("annual_quote_volume_usdt").notNull(),
    annualTradeSharePct: real("annual_trade_share_pct").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    codeUnique: uniqueIndex("idx_coins_code_unique").on(table.code),
    rankUnique: uniqueIndex("idx_coins_rank_unique").on(table.rank)
  })
);

export const dailyReports = sqliteTable(
  "daily_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportDate: text("report_date").notNull(),
    summaryZh: text("summary_zh").notNull(),
    summaryEn: text("summary_en").notNull(),
    totalQuoteVolumeUsdt: real("total_quote_volume_usdt").notNull(),
    upCount: integer("up_count").notNull(),
    downCount: integer("down_count").notNull(),
    flatCount: integer("flat_count").notNull(),
    leaderCode: text("leader_code"),
    leaderChange24hPct: real("leader_change_24h_pct"),
    laggardCode: text("laggard_code"),
    laggardChange24hPct: real("laggard_change_24h_pct"),
    generatedAt: text("generated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reportDateUnique: uniqueIndex("idx_daily_reports_date_unique").on(table.reportDate)
  })
);

export const dailyCoinSnapshots = sqliteTable(
  "daily_coin_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id").notNull(),
    code: text("code").notNull(),
    pair: text("pair").notNull(),
    priceUsdt: real("price_usdt").notNull(),
    change24hPct: real("change_24h_pct").notNull(),
    high24h: real("high_24h").notNull(),
    low24h: real("low_24h").notNull(),
    quoteVolume24hUsdt: real("quote_volume_24h_usdt").notNull(),
    tradeSharePct: real("trade_share_pct").notNull(),
    closeTime: text("close_time").notNull()
  },
  (table) => ({
    reportCodeIdx: index("idx_daily_coin_snapshots_report_code").on(table.reportId, table.code),
    codeReportIdx: index("idx_daily_coin_snapshots_code_report").on(table.code, table.reportId)
  })
);

export const cryptoNewsRaw = sqliteTable(
  "crypto_news_raw",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceName: text("source_name").notNull(),
    sourceType: text("source_type").notNull(),
    sourceUrl: text("source_url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    publishedAt: text("published_at").notNull(),
    fetchedAt: text("fetched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    rawHash: text("raw_hash").notNull(),
    ingestStatus: text("ingest_status").notNull().default("pending")
  },
  (table) => ({
    rawHashUnique: uniqueIndex("idx_crypto_news_raw_hash_unique").on(table.rawHash),
    publishedIdx: index("idx_crypto_news_raw_published").on(table.publishedAt),
    statusIdx: index("idx_crypto_news_raw_status").on(table.ingestStatus)
  })
);

export const cryptoNewsItems = sqliteTable(
  "crypto_news_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rawId: integer("raw_id").notNull(),
    title: text("title").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    sourceName: text("source_name").notNull(),
    sourceType: text("source_type").notNull(),
    publishedAt: text("published_at").notNull(),
    summaryZh: text("summary_zh").notNull(),
    summaryEn: text("summary_en").notNull(),
    relevanceType: text("relevance_type").notNull(),
    eventType: text("event_type").notNull(),
    signalScore: integer("signal_score").notNull(),
    noiseScore: integer("noise_score").notNull(),
    confidence: real("confidence").notNull(),
    shouldDisplay: integer("should_display", { mode: "boolean" }).notNull().default(false),
    isMarketWide: integer("is_market_wide", { mode: "boolean" }).notNull().default(false),
    reason: text("reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    rawIdUnique: uniqueIndex("idx_crypto_news_items_raw_id_unique").on(table.rawId),
    publishedIdx: index("idx_crypto_news_items_published").on(table.publishedAt),
    displayIdx: index("idx_crypto_news_items_display").on(table.shouldDisplay, table.isMarketWide, table.publishedAt)
  })
);

export const cryptoNewsItemCoins = sqliteTable(
  "crypto_news_item_coins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    newsItemId: integer("news_item_id").notNull(),
    coinCode: text("coin_code").notNull(),
    relationConfidence: real("relation_confidence").notNull().default(0),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false)
  },
  (table) => ({
    itemCoinUnique: uniqueIndex("idx_crypto_news_item_coin_unique").on(table.newsItemId, table.coinCode),
    coinIdx: index("idx_crypto_news_item_coin_code").on(table.coinCode, table.newsItemId)
  })
);

export const cryptoNewsItemTopics = sqliteTable(
  "crypto_news_item_topics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    newsItemId: integer("news_item_id").notNull(),
    topicCode: text("topic_code").notNull()
  },
  (table) => ({
    itemTopicUnique: uniqueIndex("idx_crypto_news_item_topic_unique").on(table.newsItemId, table.topicCode),
    topicIdx: index("idx_crypto_news_item_topic_code").on(table.topicCode, table.newsItemId)
  })
);

export const cryptoNewsClusters = sqliteTable(
  "crypto_news_clusters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clusterKey: text("cluster_key").notNull(),
    clusterLabel: text("cluster_label").notNull(),
    representativeNewsItemId: integer("representative_news_item_id").notNull(),
    importanceScore: integer("importance_score").notNull(),
    marketImpact: text("market_impact").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    clusterKeyUnique: uniqueIndex("idx_crypto_news_clusters_key_unique").on(table.clusterKey),
    representativeIdx: index("idx_crypto_news_clusters_rep").on(table.representativeNewsItemId)
  })
);

export const cryptoNewsClusterMembers = sqliteTable(
  "crypto_news_cluster_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clusterId: integer("cluster_id").notNull(),
    newsItemId: integer("news_item_id").notNull()
  },
  (table) => ({
    clusterMemberUnique: uniqueIndex("idx_crypto_news_cluster_member_unique").on(table.clusterId, table.newsItemId),
    memberIdx: index("idx_crypto_news_cluster_member_item").on(table.newsItemId, table.clusterId)
  })
);
