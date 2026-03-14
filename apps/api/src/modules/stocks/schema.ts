import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const stocks = sqliteTable(
  "stocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    codes: text("codes").notNull(),
    businessType: text("business_type").notNull(),
    aliasesJson: text("aliases_json").notNull().default("[]"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: text("deleted_at")
  },
  (table) => ({
    symbolUnique: uniqueIndex("idx_stocks_symbol_unique").on(table.symbol),
    activeSortIdx: index("idx_stocks_active_sort").on(table.isActive, table.sortOrder, table.id)
  })
);

export const reportRuns = sqliteTable(
  "report_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportDateEt: text("report_date_et").notNull(),
    runType: text("run_type").notNull().default("daily_report"),
    marketOverview: text("market_overview"),
    marketOverviewEn: text("market_overview_en"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    dateIdx: index("idx_report_runs_date").on(table.reportDateEt),
    typeDateIdx: index("idx_report_runs_type_date").on(table.runType, table.reportDateEt),
    typeIdIdx: index("idx_report_runs_type_id").on(table.runType, table.id)
  })
);

export const reportQuotes = sqliteTable(
  "report_quotes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id").notNull(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    close: real("close").notNull(),
    previousClose: real("previous_close").notNull(),
    changePct: real("change_pct").notNull(),
    volume: integer("volume").notNull(),
    turnoverEstimate: real("turnover_estimate").notNull(),
    currency: text("currency").notNull()
  },
  (table) => ({
    symbolRunIdx: index("idx_report_quotes_symbol_run").on(table.symbol, table.runId)
  })
);

export const reportNews = sqliteTable(
  "report_news",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id").notNull(),
    symbol: text("symbol").notNull(),
    title: text("title").notNull(),
    link: text("link").notNull(),
    source: text("source").notNull(),
    publishedAt: text("published_at").notNull(),
    bodySnippet: text("body_snippet"),
    aiSummary: text("ai_summary"),
    aiSummaryEn: text("ai_summary_en")
  },
  (table) => ({
    runSymbolIdx: index("idx_report_news_run_symbol").on(table.runId, table.symbol),
    symbolRunIdx: index("idx_report_news_symbol_run").on(table.symbol, table.runId)
  })
);

export const marketIndexSnapshots = sqliteTable(
  "market_index_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshotDate: text("snapshot_date").notNull(),
    indexKey: text("index_key").notNull(),
    symbol: text("symbol").notNull(),
    region: text("region").notNull(),
    nameZh: text("name_zh").notNull(),
    nameEn: text("name_en").notNull(),
    close: real("close").notNull(),
    previousClose: real("previous_close").notNull(),
    changeAbs: real("change_abs").notNull(),
    changePct: real("change_pct").notNull(),
    currency: text("currency").notNull(),
    quoteTimestamp: text("quote_timestamp").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    snapshotUnique: uniqueIndex("idx_market_index_snapshots_date_key_unique").on(table.snapshotDate, table.indexKey),
    snapshotDateIdx: index("idx_market_index_snapshots_date").on(table.snapshotDate),
    regionDateIdx: index("idx_market_index_snapshots_region_date").on(table.region, table.snapshotDate)
  })
);

export const marketAiSummaries = sqliteTable(
  "market_ai_summaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    summaryDate: text("summary_date").notNull(),
    scope: text("scope").notNull(),
    summaryZh: text("summary_zh"),
    summaryEn: text("summary_en"),
    model: text("model"),
    snapshotCount: integer("snapshot_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    summaryUnique: uniqueIndex("idx_market_ai_summaries_date_scope_unique").on(table.summaryDate, table.scope),
    summaryDateIdx: index("idx_market_ai_summaries_date").on(table.summaryDate)
  })
);
