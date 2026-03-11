import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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

