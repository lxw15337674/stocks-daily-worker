import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  MarketAiSummary,
  MarketAiSummaryRecord,
  MarketAiSummaryResponse,
  MarketIndexArchiveResponse,
  MarketIndexKey,
  MarketIndexLatestRegionGroup,
  MarketIndexLiveItem,
  MarketIndexRange,
  MarketIndexSnapshot,
  MarketIndicesAdminRunResponse,
  MarketRegion,
  MarketSummaryType
} from "@china-stocks/contracts";
import {
  compareSnapshots,
  fetchLatestMarketSnapshots,
  REGION_ORDER,
  TRACKED_MARKET_INDICES
} from "./indices-core.ts";
import {
  getLiveMarketIndicesHistory as getLiveMarketIndicesHistoryCore,
  getLiveMarketIndicesLatest as getLiveMarketIndicesLatestCore
} from "./indices-live.ts";
import { marketAiSummaries, marketIndexSnapshots } from "./schema.ts";

interface Env {
  DB?: D1Database;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  AI_MODEL?: string;
  AI_GATEWAY_BASE_URL?: string;
  AI_API_KEY?: string;
}

type SummaryBuildResult = {
  region: MarketRegion;
  summaryZh: string;
  summaryEn: string;
  model: string | null;
  sourceQuoteTimestamp: string | null;
};

const SUMMARY_SCOPE_PREFIX = "global_indices";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const MARKET_DATE_TIMEZONE = "America/New_York";

export async function getLiveMarketIndicesLatest() {
  return getLiveMarketIndicesLatestCore();
}

export async function getLiveMarketIndicesHistory(requestedIndexKeys: string[], range: MarketIndexRange) {
  return getLiveMarketIndicesHistoryCore(requestedIndexKeys, range);
}

export async function getArchivedMarketIndicesByDate(env: Env, snapshotDate: string): Promise<MarketIndexArchiveResponse> {
  if (!env.DB) {
    return buildArchivedMarketIndicesResponse(snapshotDate, []);
  }

  await ensureIndicesSchema(env.DB);
  return getPersistedSnapshotResponseByDate(env.DB, snapshotDate);
}

export async function getLatestIntradayMarketAiSummaries(env: Env): Promise<MarketAiSummaryResponse> {
  return getLatestMarketAiSummariesByType(env, "intraday");
}

export async function getLatestFinalMarketAiSummaries(env: Env): Promise<MarketAiSummaryResponse> {
  return getLatestMarketAiSummariesByType(env, "final");
}

export async function getFinalMarketAiSummariesByDate(env: Env, summaryDate: string): Promise<MarketAiSummaryResponse> {
  if (!env.DB) {
    return { items: [] };
  }

  await ensureIndicesSchema(env.DB);
  return {
    items: await getPersistedSummaryItemsByDateAndType(env.DB, summaryDate, "final")
  };
}

export async function runMarketIndicesAdminSync(
  env: Env,
  summaryType: MarketSummaryType = "intraday"
): Promise<MarketIndicesAdminRunResponse> {
  const result = await syncAndPersistRegionalMarketSummaries(env, summaryType);
  return {
    ok: true,
    summaryDate: result.summaryDate,
    summaryType,
    snapshotCount: result.snapshotCount,
    summaries: result.summaries.map(toMarketAiSummary)
  };
}

export async function runMarketIndicesScheduledSync(env: Env, summaryType: MarketSummaryType): Promise<void> {
  try {
    await syncAndPersistRegionalMarketSummaries(env, summaryType);
  } catch (error) {
    console.error(`[MARKET_INDICES] Scheduled ${summaryType} sync failed:`, error);
    throw error;
  }
}

async function getLatestMarketAiSummariesByType(env: Env, summaryType: MarketSummaryType): Promise<MarketAiSummaryResponse> {
  if (!env.DB) {
    return { items: [] };
  }

  await ensureIndicesSchema(env.DB);
  return {
    items: await getLatestPersistedSummaryItemsByType(env.DB, summaryType)
  };
}

async function syncAndPersistRegionalMarketSummaries(
  env: Env,
  summaryType: MarketSummaryType
): Promise<{ summaryDate: string; snapshotCount: number; summaries: MarketAiSummaryRecord[] }> {
  if (!env.DB) {
    throw new Error("DB binding is required for market summary sync.");
  }

  await ensureIndicesSchema(env.DB);
  const items = await fetchLatestMarketSnapshots();
  const summaryDate = formatDate(new Date(), MARKET_DATE_TIMEZONE);
  const summaries = await buildRegionalSummaries(env, items);

  if (summaryType === "final") {
    await persistMarketSnapshots(env.DB, summaryDate, items);
  }
  const records = await persistMarketSummaries(env.DB, summaryDate, items, summaries, summaryType);

  return {
    summaryDate,
    snapshotCount: items.length,
    summaries: records
  };
}

async function ensureIndicesSchema(db: D1Database): Promise<void> {
  const createStatements = [
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

  for (const statement of createStatements) {
    await db.prepare(statement).run();
  }

  const alterStatements = [
    "ALTER TABLE market_index_snapshots ADD COLUMN day_open REAL",
    "ALTER TABLE market_index_snapshots ADD COLUMN day_high REAL",
    "ALTER TABLE market_index_snapshots ADD COLUMN day_low REAL",
    "ALTER TABLE market_index_snapshots ADD COLUMN day_volume INTEGER",
    "ALTER TABLE market_index_snapshots ADD COLUMN day_range_pct REAL",
    "ALTER TABLE market_index_snapshots ADD COLUMN fifty_two_week_high REAL",
    "ALTER TABLE market_index_snapshots ADD COLUMN fifty_two_week_low REAL",
    "ALTER TABLE market_ai_summaries ADD COLUMN region TEXT",
    "ALTER TABLE market_ai_summaries ADD COLUMN summary_type TEXT",
    "ALTER TABLE market_ai_summaries ADD COLUMN source_quote_timestamp TEXT"
  ];

  for (const statement of alterStatements) {
    await runAlterIfNeeded(db, statement);
  }

  const indexStatements = [
    "CREATE INDEX IF NOT EXISTS idx_market_ai_summaries_date_region_type ON market_ai_summaries(summary_date, region, summary_type)"
  ];
  for (const statement of indexStatements) {
    await db.prepare(statement).run();
  }
}

async function runAlterIfNeeded(db: D1Database, statement: string): Promise<void> {
  try {
    await db.prepare(statement).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("duplicate column name")) {
      throw error;
    }
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
        dayOpen: item.dayOpen,
        dayHigh: item.dayHigh,
        dayLow: item.dayLow,
        dayVolume: item.dayVolume,
        dayRangePct: item.dayRangePct,
        fiftyTwoWeekHigh: item.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: item.fiftyTwoWeekLow,
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
          dayOpen: item.dayOpen,
          dayHigh: item.dayHigh,
          dayLow: item.dayLow,
          dayVolume: item.dayVolume,
          dayRangePct: item.dayRangePct,
          fiftyTwoWeekHigh: item.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: item.fiftyTwoWeekLow,
          currency: item.currency,
          quoteTimestamp: item.quoteTimestamp,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });
  }
}

async function persistMarketSummaries(
  dbBinding: D1Database,
  summaryDate: string,
  items: MarketIndexSnapshot[],
  summaries: SummaryBuildResult[],
  summaryType: MarketSummaryType
): Promise<MarketAiSummaryRecord[]> {
  const db = drizzle(dbBinding);

  for (const summary of summaries) {
    await db
      .insert(marketAiSummaries)
      .values({
        summaryDate,
        scope: resolveSummaryScope(summary.region, summaryType),
        region: summary.region,
        summaryType,
        summaryZh: summary.summaryZh,
        summaryEn: summary.summaryEn,
        snapshotCount: items.filter((item) => item.region === summary.region).length,
        sourceQuoteTimestamp: summary.sourceQuoteTimestamp,
        model: summary.model
      })
      .onConflictDoUpdate({
        target: [marketAiSummaries.summaryDate, marketAiSummaries.scope],
        set: {
          region: summary.region,
          summaryType,
          summaryZh: summary.summaryZh,
          summaryEn: summary.summaryEn,
          snapshotCount: items.filter((item) => item.region === summary.region).length,
          sourceQuoteTimestamp: summary.sourceQuoteTimestamp,
          model: summary.model,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });
  }

  return getPersistedSummaryRecordsByDateAndType(dbBinding, summaryDate, summaryType);
}

async function getPersistedSnapshotResponseByDate(
  dbBinding: D1Database,
  snapshotDate: string
): Promise<MarketIndexArchiveResponse> {
  const db = drizzle(dbBinding);
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
      dayOpen: marketIndexSnapshots.dayOpen,
      dayHigh: marketIndexSnapshots.dayHigh,
      dayLow: marketIndexSnapshots.dayLow,
      dayVolume: marketIndexSnapshots.dayVolume,
      dayRangePct: marketIndexSnapshots.dayRangePct,
      fiftyTwoWeekHigh: marketIndexSnapshots.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: marketIndexSnapshots.fiftyTwoWeekLow,
      currency: marketIndexSnapshots.currency,
      quoteTimestamp: marketIndexSnapshots.quoteTimestamp
    })
    .from(marketIndexSnapshots)
    .where(eq(marketIndexSnapshots.snapshotDate, snapshotDate));

  const items = snapshotRows.map(mapSnapshotRowToRecord).sort(compareSnapshots);
  return buildArchivedMarketIndicesResponse(snapshotDate, items);
}

async function getLatestPersistedSummaryItemsByType(
  dbBinding: D1Database,
  summaryType: MarketSummaryType
): Promise<MarketAiSummary[]> {
  const db = drizzle(dbBinding);
  const latestRow = (
    await db
      .select({
        summaryDate: marketAiSummaries.summaryDate
      })
      .from(marketAiSummaries)
      .where(eq(marketAiSummaries.summaryType, summaryType))
      .orderBy(desc(marketAiSummaries.summaryDate), desc(marketAiSummaries.id))
      .limit(1)
  )[0];

  if (!latestRow) {
    return [];
  }

  return getPersistedSummaryItemsByDateAndType(dbBinding, latestRow.summaryDate, summaryType);
}

async function getPersistedSummaryItemsByDateAndType(
  dbBinding: D1Database,
  summaryDate: string,
  summaryType: MarketSummaryType
): Promise<MarketAiSummary[]> {
  const records = await getPersistedSummaryRecordsByDateAndType(dbBinding, summaryDate, summaryType);
  return records.map(toMarketAiSummary);
}

async function getPersistedSummaryRecordsByDateAndType(
  dbBinding: D1Database,
  summaryDate: string,
  summaryType: MarketSummaryType
): Promise<MarketAiSummaryRecord[]> {
  const db = drizzle(dbBinding);
  const summaryRows = await db
    .select({
      summaryDate: marketAiSummaries.summaryDate,
      region: marketAiSummaries.region,
      summaryType: marketAiSummaries.summaryType,
      summaryZh: marketAiSummaries.summaryZh,
      summaryEn: marketAiSummaries.summaryEn,
      snapshotCount: marketAiSummaries.snapshotCount,
      sourceQuoteTimestamp: marketAiSummaries.sourceQuoteTimestamp,
      createdAt: marketAiSummaries.createdAt,
      model: marketAiSummaries.model
    })
    .from(marketAiSummaries)
    .where(and(eq(marketAiSummaries.summaryDate, summaryDate), eq(marketAiSummaries.summaryType, summaryType)))
    .orderBy(desc(marketAiSummaries.id));

  return summaryRows
    .map((row): MarketAiSummaryRecord | null => {
      const region = normalizeMarketRegion(row.region);
      const normalizedType = normalizeSummaryType(row.summaryType);
      if (!region || !normalizedType) {
        return null;
      }

      return {
        summaryDate: row.summaryDate,
        region,
        summaryType: normalizedType,
        summary: {
          zh: row.summaryZh ?? null,
          en: row.summaryEn ?? null
        },
        snapshotCount: row.snapshotCount,
        sourceQuoteTimestamp: row.sourceQuoteTimestamp ?? null,
        createdAt: row.createdAt,
        model: row.model ?? null
      };
    })
    .filter((item): item is MarketAiSummaryRecord => item !== null)
    .sort((left, right) => REGION_ORDER.indexOf(left.region) - REGION_ORDER.indexOf(right.region));
}

function normalizeMarketRegion(value: string | null): MarketRegion | null {
  if (value === "cn" || value === "hk" || value === "us") {
    return value;
  }
  return null;
}

function normalizeSummaryType(value: string | null): MarketSummaryType | null {
  if (value === "intraday" || value === "final") {
    return value;
  }
  return null;
}

function resolveSummaryScope(region: MarketRegion, summaryType: MarketSummaryType): string {
  return `${SUMMARY_SCOPE_PREFIX}_${region}_${summaryType}`;
}

function mapSnapshotRowToRecord(row: {
  indexKey: string;
  symbol: string;
  region: string;
  nameZh: string;
  nameEn: string;
  close: number;
  previousClose: number;
  changeAbs: number;
  changePct: number;
  dayOpen: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  dayVolume: number | null;
  dayRangePct: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  currency: string;
  quoteTimestamp: string;
}): MarketIndexSnapshot {
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
    dayOpen: row.dayOpen,
    dayHigh: row.dayHigh,
    dayLow: row.dayLow,
    dayVolume: row.dayVolume,
    dayRangePct: row.dayRangePct,
    fiftyTwoWeekHigh: row.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: row.fiftyTwoWeekLow,
    currency: row.currency,
    quoteTimestamp: row.quoteTimestamp,
    isPrimary: definition?.isPrimary ?? false
  };
}

function buildArchivedMarketIndicesResponse(
  snapshotDate: string,
  items: MarketIndexSnapshot[]
): MarketIndexArchiveResponse {
  const regions: MarketIndexLatestRegionGroup[] = REGION_ORDER.map((region) => {
    const definitions = TRACKED_MARKET_INDICES.filter((item) => item.region === region);
    const primaryDefinition = definitions.find((item) => item.isPrimary) ?? definitions[0] ?? null;
    return {
      region,
      primaryIndexKey: primaryDefinition?.indexKey ?? "",
      items: items
        .filter((item) => item.region === region)
        .map((item): MarketIndexLiveItem => ({
          indexKey: item.indexKey,
          symbol: item.symbol,
          region: item.region,
          nameZh: item.nameZh,
          nameEn: item.nameEn,
          price: item.close,
          previousClose: item.previousClose,
          changeAbs: item.changeAbs,
          changePct: item.changePct,
          dayOpen: item.dayOpen,
          dayHigh: item.dayHigh,
          dayLow: item.dayLow,
          dayVolume: item.dayVolume,
          dayRangePct: item.dayRangePct,
          fiftyTwoWeekHigh: item.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: item.fiftyTwoWeekLow,
          currency: item.currency,
          quoteTimestamp: item.quoteTimestamp,
          isPrimary: item.isPrimary
        }))
    };
  });

  const updatedAt =
    items
      .map((item) => item.quoteTimestamp)
      .filter((value) => value.length > 0)
      .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    snapshotDate,
    updatedAt,
    regions
  };
}

async function buildRegionalSummaries(env: Env, items: MarketIndexSnapshot[]): Promise<SummaryBuildResult[]> {
  const results = await Promise.all(
    REGION_ORDER.map(async (region) => buildRegionalSummary(env, region, items.filter((item) => item.region === region)))
  );
  return results.filter((item): item is SummaryBuildResult => item !== null);
}

async function buildRegionalSummary(
  env: Env,
  region: MarketRegion,
  items: MarketIndexSnapshot[]
): Promise<SummaryBuildResult | null> {
  if (items.length === 0) {
    return null;
  }

  const fallbackZh = buildFallbackSummaryZh(region, items);
  const fallbackEn = buildFallbackSummaryEn(region, items);

  const aiRaw = await callAiCompatible(
    env,
    "You are a market editor. Summarize only the provided regional index snapshot and trading metrics. Return strict JSON with keys summaryZh and summaryEn. Keep both concise, factual, and free of investment advice.",
    buildRegionalSummaryPrompt(region, items)
  );

  const parsed = parseSummaryJson(aiRaw);
  return {
    region,
    summaryZh: parsed?.summaryZh ?? fallbackZh,
    summaryEn: parsed?.summaryEn ?? fallbackEn,
    model: parsed ? env.AI_MODEL ?? OPENAI_DEFAULT_MODEL : null,
    sourceQuoteTimestamp: items.map((item) => item.quoteTimestamp).sort((left, right) => right.localeCompare(left))[0] ?? null
  };
}

function buildRegionalSummaryPrompt(region: MarketRegion, items: MarketIndexSnapshot[]): string {
  const primary = pickPrimarySnapshot(items, region);
  const itemLines = items
    .map(
      (item) =>
        `- ${item.nameEn} | close=${formatPromptNumber(item.close)} | prev=${formatPromptNumber(item.previousClose)} | move=${formatSignedPct(item.changePct)} | O/H/L=${formatPromptNumber(item.dayOpen)}/${formatPromptNumber(item.dayHigh)}/${formatPromptNumber(item.dayLow)} | vol=${formatPromptVolume(item.dayVolume)} | range=${formatPromptPct(item.dayRangePct)} | 52w=${formatPromptNumber(item.fiftyTwoWeekLow)}-${formatPromptNumber(item.fiftyTwoWeekHigh)}`
    )
    .join("\n");

  return [
    `Generate one concise bilingual summary for the ${regionLabelEn(region)} market.`,
    "Requirements:",
    "1. summaryZh <= 90 Chinese characters.",
    "2. summaryEn <= 180 English characters.",
    "3. Describe only what is observable in the supplied data.",
    "4. Mention direction, structure, and trading metrics when useful, such as high/low range, open/high/low, or volume.",
    "5. Do not infer macro causes or provide investment advice.",
    primary
      ? `Primary benchmark: ${primary.nameEn}, move=${formatSignedPct(primary.changePct)}, O/H/L=${formatPromptNumber(primary.dayOpen)}/${formatPromptNumber(primary.dayHigh)}/${formatPromptNumber(primary.dayLow)}, vol=${formatPromptVolume(primary.dayVolume)}, range=${formatPromptPct(primary.dayRangePct)}`
      : "Primary benchmark: unavailable",
    `Snapshot:\n${itemLines}`
  ].join("\n");
}

function buildFallbackSummaryZh(region: MarketRegion, items: MarketIndexSnapshot[]): string {
  if (items.length === 0) {
    return `当前未获取到${regionLabelZh(region)}指数快照。`;
  }

  const primary = pickPrimarySnapshot(items, region) ?? items[0]!;
  const strongest = [...items].sort((left, right) => right.changePct - left.changePct)[0]!;
  const weakest = [...items].sort((left, right) => left.changePct - right.changePct)[0]!;
  const volumeClause = primary.dayVolume !== null ? `，成交量约${formatPromptVolume(primary.dayVolume)}` : "";
  const rangeClause = primary.dayRangePct !== null ? `，日振幅${primary.dayRangePct.toFixed(2)}%` : "";

  return `${regionLabelZh(region)}方面，${primary.nameZh}${formatSignedPct(primary.changePct)}，区间高低点为${formatPromptNumber(primary.dayHigh)}/${formatPromptNumber(primary.dayLow)}${volumeClause}${rangeClause}；同区间内偏强的是${strongest.nameZh}，偏弱的是${weakest.nameZh}。`;
}

function buildFallbackSummaryEn(region: MarketRegion, items: MarketIndexSnapshot[]): string {
  if (items.length === 0) {
    return `No ${regionLabelEn(region)} index snapshot is currently available.`;
  }

  const primary = pickPrimarySnapshot(items, region) ?? items[0]!;
  const strongest = [...items].sort((left, right) => right.changePct - left.changePct)[0]!;
  const weakest = [...items].sort((left, right) => left.changePct - right.changePct)[0]!;
  const volumeClause = primary.dayVolume !== null ? `, with volume around ${formatPromptVolume(primary.dayVolume)}` : "";
  const rangeClause = primary.dayRangePct !== null ? ` and an intraday range of ${primary.dayRangePct.toFixed(2)}%` : "";

  return `${regionLabelEn(region)} was led by ${primary.nameEn} at ${formatSignedPct(primary.changePct)}${rangeClause}${volumeClause}. Within the same region, ${strongest.nameEn} was strongest while ${weakest.nameEn} lagged.`;
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
    region: record.region,
    summaryType: record.summaryType,
    summaryZh: record.summary.zh,
    summaryEn: record.summary.en,
    model: record.model ?? null,
    snapshotCount: record.snapshotCount,
    sourceQuoteTimestamp: record.sourceQuoteTimestamp,
    createdAt: record.createdAt
  };
}

export function joinRegionalSummaries(
  items: MarketAiSummary[],
  language: "zh" | "en"
): string | null {
  const text = items
    .sort((left, right) => REGION_ORDER.indexOf(left.region) - REGION_ORDER.indexOf(right.region))
    .map((item) => (language === "zh" ? item.summaryZh : item.summaryEn) ?? item.summaryZh ?? item.summaryEn ?? null)
    .filter((item): item is string => Boolean(item && item.length > 0))
    .join(language === "zh" ? " " : " ");

  return text.length > 0 ? text : null;
}

function sanitizeParagraph(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatSignedPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPromptNumber(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

function formatPromptPct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "-" : `${value.toFixed(2)}%`;
}

function formatPromptVolume(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(0);
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
