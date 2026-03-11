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