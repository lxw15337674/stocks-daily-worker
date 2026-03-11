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
    marketOverview: text("market_overview"),
    marketOverviewEn: text("market_overview_en"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    dateIdx: index("idx_report_runs_date").on(table.reportDateEt),
    dateUnique: uniqueIndex("idx_report_runs_date_unique").on(table.reportDateEt)
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
    aiSummary: text("ai_summary"),
    aiSummaryEn: text("ai_summary_en")
  },
  (table) => ({
    runSymbolIdx: index("idx_report_news_run_symbol").on(table.runId, table.symbol),
    symbolRunIdx: index("idx_report_news_symbol_run").on(table.symbol, table.runId)
  })
);

