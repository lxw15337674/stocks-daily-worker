import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  MarketAiSummary,
  MarketAiSummaryRecord,
  MarketAiSummaryResponse,
  MarketIndexKey,
  MarketIndexRange,
  MarketIndexSnapshot,
  MarketIndicesAdminRunResponse,
  MarketRegion
} from "@china-stocks/contracts";
import {
  compareSnapshots,
  fetchLatestMarketSnapshots,
  REGION_ORDER,
  TRACKED_MARKET_INDICES
} from "./indices-core";
import {
  getLiveMarketIndicesHistory as getLiveMarketIndicesHistoryCore,
  getLiveMarketIndicesLatest as getLiveMarketIndicesLatestCore
} from "./indices-live";
import { marketAiSummaries, marketIndexSnapshots } from "./schema";

interface Env {
  DB?: D1Database;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  AI_MODEL?: string;
  AI_GATEWAY_BASE_URL?: string;
  AI_API_KEY?: string;
}

type SummaryBuildResult = {
  summaryZh: string;
  summaryEn: string;
  model: string | null;
};

const SUMMARY_SCOPE = "global_indices";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const SHANGHAI_TIMEZONE = "Asia/Shanghai";

export async function getLiveMarketIndicesLatest() {
  return getLiveMarketIndicesLatestCore();
}

export async function getLiveMarketIndicesHistory(requestedIndexKeys: string[], range: MarketIndexRange) {
  return getLiveMarketIndicesHistoryCore(requestedIndexKeys, range);
}

export async function getLatestMarketAiSummary(env: Env): Promise<MarketAiSummaryResponse> {
  if (!env.DB) {
    return { item: null };
  }

  await ensureIndicesSchema(env.DB);
  const record = await getLatestPersistedSummaryRecord(env.DB);
  return {
    item: record ? toMarketAiSummary(record) : null
  };
}

export async function getMarketAiSummaryByDate(env: Env, summaryDate: string): Promise<MarketAiSummaryResponse> {
  if (!env.DB) {
    return { item: null };
  }

  await ensureIndicesSchema(env.DB);
  const record = await getPersistedSummaryRecordByDate(env.DB, summaryDate);
  return {
    item: record ? toMarketAiSummary(record) : null
  };
}

export async function runMarketIndicesAdminSync(env: Env): Promise<MarketIndicesAdminRunResponse> {
  const record = await syncAndPersistGlobalMarketSummary(env);
  return {
    ok: true,
    summaryDate: record.summaryDate,
    snapshotCount: record.snapshotCount,
    summary: toMarketAiSummary(record)
  };
}

export async function runMarketIndicesScheduledSync(env: Env): Promise<void> {
  try {
    await syncAndPersistGlobalMarketSummary(env);
  } catch (error) {
    console.error("[MARKET_INDICES] Scheduled sync failed:", error);
    throw error;
  }
}

async function syncAndPersistGlobalMarketSummary(env: Env): Promise<MarketAiSummaryRecord> {
  if (!env.DB) {
    throw new Error("DB binding is required for global market summary sync.");
  }

  await ensureIndicesSchema(env.DB);
  const items = await fetchLatestMarketSnapshots();
  const summaryDate = formatDate(new Date(), SHANGHAI_TIMEZONE);
  const summary = await buildMarketSummary(env, items);

  await persistMarketSnapshots(env.DB, summaryDate, items);
  const createdAt = await persistMarketSummary(env.DB, summaryDate, items, summary);

  return {
    summaryDate,
    scope: SUMMARY_SCOPE,
    summary: {
      zh: summary.summaryZh,
      en: summary.summaryEn
    },
    snapshotCount: items.length,
    createdAt,
    items,
    model: summary.model
  };
}

async function ensureIndicesSchema(db: D1Database): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS market_index_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      index_key TEXT NOT NULL,
      symbol TEXT NOT NULL,
      region TEXT NOT NULL,
      name_zh TEXT NOT NULL,
      name_en TEXT NOT NULL,
      close REAL NOT NULL,
      previous_close REAL NOT NULL,
      change_abs REAL NOT NULL,
      change_pct REAL NOT NULL,
      currency TEXT NOT NULL,
      quote_timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_market_index_snapshots_date_key_unique ON market_index_snapshots(snapshot_date, index_key)",
    "CREATE INDEX IF NOT EXISTS idx_market_index_snapshots_date ON market_index_snapshots(snapshot_date)",
    "CREATE INDEX IF NOT EXISTS idx_market_index_snapshots_region_date ON market_index_snapshots(region, snapshot_date)",
    `CREATE TABLE IF NOT EXISTS market_ai_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_date TEXT NOT NULL,
      scope TEXT NOT NULL,
      summary_zh TEXT,
      summary_en TEXT,
      model TEXT,
      snapshot_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_market_ai_summaries_date_scope_unique ON market_ai_summaries(summary_date, scope)",
    "CREATE INDEX IF NOT EXISTS idx_market_ai_summaries_date ON market_ai_summaries(summary_date)"
  ];

  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}

async function persistMarketSnapshots(dbBinding: D1Database, summaryDate: string, items: MarketIndexSnapshot[]): Promise<void> {
  const db = drizzle(dbBinding);

  for (const item of items) {
    await db
      .insert(marketIndexSnapshots)
      .values({
        snapshotDate: summaryDate,
        indexKey: item.indexKey,
        symbol: item.symbol,
        region: item.region,
        nameZh: item.nameZh,
        nameEn: item.nameEn,
        close: item.close,
        previousClose: item.previousClose,
        changeAbs: item.changeAbs,
        changePct: item.changePct,
        currency: item.currency,
        quoteTimestamp: item.quoteTimestamp
      })
      .onConflictDoUpdate({
        target: [marketIndexSnapshots.snapshotDate, marketIndexSnapshots.indexKey],
        set: {
          symbol: item.symbol,
          region: item.region,
          nameZh: item.nameZh,
          nameEn: item.nameEn,
          close: item.close,
          previousClose: item.previousClose,
          changeAbs: item.changeAbs,
          changePct: item.changePct,
          currency: item.currency,
          quoteTimestamp: item.quoteTimestamp,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });
  }
}

async function persistMarketSummary(
  dbBinding: D1Database,
  summaryDate: string,
  items: MarketIndexSnapshot[],
  summary: SummaryBuildResult
): Promise<string> {
  const db = drizzle(dbBinding);

  await db
    .insert(marketAiSummaries)
    .values({
      summaryDate,
      scope: SUMMARY_SCOPE,
      summaryZh: summary.summaryZh,
      summaryEn: summary.summaryEn,
      snapshotCount: items.length,
      model: summary.model
    })
    .onConflictDoUpdate({
      target: [marketAiSummaries.summaryDate, marketAiSummaries.scope],
      set: {
        summaryZh: summary.summaryZh,
        summaryEn: summary.summaryEn,
        snapshotCount: items.length,
        model: summary.model,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

  const row = (
    await db
      .select({
        createdAt: marketAiSummaries.createdAt
      })
      .from(marketAiSummaries)
      .where(eq(marketAiSummaries.summaryDate, summaryDate))
      .limit(1)
  )[0];

  return row?.createdAt ?? new Date().toISOString();
}

async function getLatestPersistedSummaryRecord(dbBinding: D1Database): Promise<MarketAiSummaryRecord | null> {
  const db = drizzle(dbBinding);
  const summaryRow = (
    await db
      .select({
        summaryDate: marketAiSummaries.summaryDate,
        scope: marketAiSummaries.scope,
        summaryZh: marketAiSummaries.summaryZh,
        summaryEn: marketAiSummaries.summaryEn,
        snapshotCount: marketAiSummaries.snapshotCount,
        createdAt: marketAiSummaries.createdAt,
        model: marketAiSummaries.model
      })
      .from(marketAiSummaries)
      .where(eq(marketAiSummaries.scope, SUMMARY_SCOPE))
      .orderBy(desc(marketAiSummaries.summaryDate), desc(marketAiSummaries.id))
      .limit(1)
  )[0];

  if (!summaryRow) {
    return null;
  }

  const snapshotRows = await db
    .select({
      indexKey: marketIndexSnapshots.indexKey,
      symbol: marketIndexSnapshots.symbol,
      region: marketIndexSnapshots.region,
      nameZh: marketIndexSnapshots.nameZh,
      nameEn: marketIndexSnapshots.nameEn,
      close: marketIndexSnapshots.close,
      previousClose: marketIndexSnapshots.previousClose,
      changeAbs: marketIndexSnapshots.changeAbs,
      changePct: marketIndexSnapshots.changePct,
      currency: marketIndexSnapshots.currency,
      quoteTimestamp: marketIndexSnapshots.quoteTimestamp
    })
    .from(marketIndexSnapshots)
    .where(eq(marketIndexSnapshots.snapshotDate, summaryRow.summaryDate));

  const items = snapshotRows
    .map((row) => {
      const definition = TRACKED_MARKET_INDICES.find((item) => item.indexKey === row.indexKey) ?? null;
      return {
        indexKey: row.indexKey as MarketIndexKey,
        symbol: row.symbol,
        region: row.region as MarketRegion,
        nameZh: row.nameZh,
        nameEn: row.nameEn,
        close: row.close,
        previousClose: row.previousClose,
        changeAbs: row.changeAbs,
        changePct: row.changePct,
        currency: row.currency,
        quoteTimestamp: row.quoteTimestamp,
        isPrimary: definition?.isPrimary ?? false
      };
    })
    .sort(compareSnapshots);

  return {
    summaryDate: summaryRow.summaryDate,
    scope: summaryRow.scope,
    summary: {
      zh: summaryRow.summaryZh ?? null,
      en: summaryRow.summaryEn ?? null
    },
    snapshotCount: summaryRow.snapshotCount,
    createdAt: summaryRow.createdAt,
    items,
    model: summaryRow.model ?? null
  };
}

async function getPersistedSummaryRecordByDate(
  dbBinding: D1Database,
  summaryDate: string
): Promise<MarketAiSummaryRecord | null> {
  const db = drizzle(dbBinding);
  const summaryRow = (
    await db
      .select({
        summaryDate: marketAiSummaries.summaryDate,
        scope: marketAiSummaries.scope,
        summaryZh: marketAiSummaries.summaryZh,
        summaryEn: marketAiSummaries.summaryEn,
        snapshotCount: marketAiSummaries.snapshotCount,
        createdAt: marketAiSummaries.createdAt,
        model: marketAiSummaries.model
      })
      .from(marketAiSummaries)
      .where(and(eq(marketAiSummaries.scope, SUMMARY_SCOPE), eq(marketAiSummaries.summaryDate, summaryDate)))
      .orderBy(desc(marketAiSummaries.id))
      .limit(1)
  )[0];

  if (!summaryRow) {
    return null;
  }

  const snapshotRows = await db
    .select({
      indexKey: marketIndexSnapshots.indexKey,
      symbol: marketIndexSnapshots.symbol,
      region: marketIndexSnapshots.region,
      nameZh: marketIndexSnapshots.nameZh,
      nameEn: marketIndexSnapshots.nameEn,
      close: marketIndexSnapshots.close,
      previousClose: marketIndexSnapshots.previousClose,
      changeAbs: marketIndexSnapshots.changeAbs,
      changePct: marketIndexSnapshots.changePct,
      currency: marketIndexSnapshots.currency,
      quoteTimestamp: marketIndexSnapshots.quoteTimestamp
    })
    .from(marketIndexSnapshots)
    .where(eq(marketIndexSnapshots.snapshotDate, summaryRow.summaryDate));

  const items = snapshotRows
    .map((row) => {
      const definition = TRACKED_MARKET_INDICES.find((item) => item.indexKey === row.indexKey) ?? null;
      return {
        indexKey: row.indexKey as MarketIndexKey,
        symbol: row.symbol,
        region: row.region as MarketRegion,
        nameZh: row.nameZh,
        nameEn: row.nameEn,
        close: row.close,
        previousClose: row.previousClose,
        changeAbs: row.changeAbs,
        changePct: row.changePct,
        currency: row.currency,
        quoteTimestamp: row.quoteTimestamp,
        isPrimary: definition?.isPrimary ?? false
      };
    })
    .sort(compareSnapshots);

  return {
    summaryDate: summaryRow.summaryDate,
    scope: summaryRow.scope,
    summary: {
      zh: summaryRow.summaryZh ?? null,
      en: summaryRow.summaryEn ?? null
    },
    snapshotCount: summaryRow.snapshotCount,
    createdAt: summaryRow.createdAt,
    items,
    model: summaryRow.model ?? null
  };
}

async function buildMarketSummary(env: Env, items: MarketIndexSnapshot[]): Promise<SummaryBuildResult> {
  const fallbackZh = buildFallbackSummaryZh(items);
  const fallbackEn = buildFallbackSummaryEn(items);

  const aiRaw = await callAiCompatible(
    env,
    "You are a market editor. Summarize only from the provided global index snapshot. Return strict JSON with keys summaryZh and summaryEn. Keep both concise, factual, and free of investment advice.",
    buildSummaryPrompt(items)
  );

  const parsed = parseSummaryJson(aiRaw);
  if (parsed?.summaryZh && parsed.summaryEn) {
    return {
      summaryZh: parsed.summaryZh,
      summaryEn: parsed.summaryEn,
      model: env.AI_MODEL ?? OPENAI_DEFAULT_MODEL
    };
  }

  return {
    summaryZh: fallbackZh,
    summaryEn: fallbackEn,
    model: null
  };
}

function buildSummaryPrompt(items: MarketIndexSnapshot[]): string {
  const lines = items
    .map(
      (item) =>
        `- ${item.region.toUpperCase()} | ${item.indexKey} | ${item.nameEn} | close=${item.close.toFixed(2)} | change=${formatSignedPct(item.changePct)}`
    )
    .join("\n");

  return [
    "Generate one concise bilingual summary for the latest global market indices snapshot.",
    "Requirements:",
    "1. summaryZh <= 90 Chinese characters.",
    "2. summaryEn <= 220 English characters.",
    "3. Mention relative strength or weakness across CN, HK, and US markets when possible.",
    "4. Do not infer macro causes that are not in the data.",
    `Snapshot:\n${lines || "- No snapshot data"}`
  ].join("\n");
}

function buildFallbackSummaryZh(items: MarketIndexSnapshot[]): string {
  if (items.length === 0) {
    return "当前未获取到全球指数快照。";
  }

  const grouped = REGION_ORDER.map((region) => {
    const primary = pickPrimarySnapshot(items, region);
    return primary ? `${regionLabelZh(region)}${formatSignedPct(primary.changePct)}` : null;
  }).filter((item): item is string => item !== null);

  const leader = [...items].sort((left, right) => right.changePct - left.changePct)[0];
  const laggard = [...items].sort((left, right) => left.changePct - right.changePct)[0];

  return `全球指数快照显示${grouped.join("，")}；表现最强的是${leader.nameZh}${formatSignedPct(leader.changePct)}，最弱的是${laggard.nameZh}${formatSignedPct(laggard.changePct)}。`;
}

function buildFallbackSummaryEn(items: MarketIndexSnapshot[]): string {
  if (items.length === 0) {
    return "No global index snapshot is currently available.";
  }

  const grouped = REGION_ORDER.map((region) => {
    const primary = pickPrimarySnapshot(items, region);
    return primary ? `${regionLabelEn(region)} ${formatSignedPct(primary.changePct)}` : null;
  }).filter((item): item is string => item !== null);

  const leader = [...items].sort((left, right) => right.changePct - left.changePct)[0];
  const laggard = [...items].sort((left, right) => left.changePct - right.changePct)[0];

  return `Global indices showed ${grouped.join(", ")}. The strongest move came from ${leader.nameEn} at ${formatSignedPct(leader.changePct)}, while ${laggard.nameEn} was weakest at ${formatSignedPct(laggard.changePct)}.`;
}

function pickPrimarySnapshot(items: MarketIndexSnapshot[], region: MarketRegion): MarketIndexSnapshot | null {
  return items.find((item) => item.region === region && item.isPrimary) ?? items.find((item) => item.region === region) ?? null;
}

function parseSummaryJson(raw: string | null): { summaryZh: string; summaryEn: string } | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart === -1 || objectEnd <= objectStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(objectStart, objectEnd + 1)) as {
      summaryZh?: unknown;
      summaryEn?: unknown;
    };
    if (typeof parsed.summaryZh !== "string" || typeof parsed.summaryEn !== "string") {
      return null;
    }

    return {
      summaryZh: sanitizeParagraph(parsed.summaryZh),
      summaryEn: sanitizeParagraph(parsed.summaryEn)
    };
  } catch {
    return null;
  }
}

async function callAiCompatible(env: Env, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const baseUrl = env.OPENAI_BASE_URL ?? env.AI_GATEWAY_BASE_URL;
  if (!baseUrl) {
    return null;
  }

  const endpoint = resolveChatCompletionsEndpoint(baseUrl);
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  const apiKey = env.OPENAI_API_KEY ?? env.AI_API_KEY;
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: env.AI_MODEL ?? OPENAI_DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  return content && content.length > 0 ? content : null;
}

function resolveChatCompletionsEndpoint(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/+$/, "");
    if (path.endsWith("/chat/completions")) {
      return url.toString();
    }
    if (path === "" || path === "/") {
      url.pathname = "/v1/chat/completions";
      return url.toString();
    }
    if (path.endsWith("/v1")) {
      url.pathname = `${path}/chat/completions`;
      return url.toString();
    }
    url.pathname = `${path}/chat/completions`;
    return url.toString();
  } catch {
    return baseUrl;
  }
}

function toMarketAiSummary(record: MarketAiSummaryRecord): MarketAiSummary {
  return {
    summaryDate: record.summaryDate,
    scope: record.scope,
    summaryZh: record.summary.zh,
    summaryEn: record.summary.en,
    model: record.model ?? null,
    snapshotCount: record.snapshotCount,
    createdAt: record.createdAt
  };
}

function guessCurrency(region: MarketRegion): string {
  if (region === "cn") {
    return "CNY";
  }
  if (region === "hk") {
    return "HKD";
  }
  return "USD";
}

function sanitizeParagraph(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatSignedPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function regionLabelZh(region: MarketRegion): string {
  if (region === "cn") {
    return "A股";
  }
  if (region === "hk") {
    return "港股";
  }
  return "美股";
}

function regionLabelEn(region: MarketRegion): string {
  if (region === "cn") {
    return "China";
  }
  if (region === "hk") {
    return "Hong Kong";
  }
  return "US";
}

function toIsoDate(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}

function formatDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
