import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  MarketAiSummary,
  MarketAiSummaryRecord,
  MarketAiSummaryResponse,
  MarketIndexHistoryPoint,
  MarketIndexHistoryResponse,
  MarketIndexHistorySeries,
  MarketIndexKey,
  MarketIndexLatestResponse,
  MarketIndexRange,
  MarketIndexSnapshot,
  MarketIndicesAdminRunResponse,
  MarketRegion
} from "@china-stocks/contracts";
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

type TrackedMarketIndex = {
  indexKey: MarketIndexKey;
  symbol: string;
  region: MarketRegion;
  nameZh: string;
  nameEn: string;
  isPrimary: boolean;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type SummaryBuildResult = {
  summaryZh: string;
  summaryEn: string;
  model: string | null;
};

const SUMMARY_SCOPE = "global_indices";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const SHANGHAI_TIMEZONE = "Asia/Shanghai";
const REGION_ORDER: MarketRegion[] = ["cn", "hk", "us"];
const HISTORY_RANGE_MAP: Record<MarketIndexRange, string> = {
  "1m": "1mo",
  "3m": "3mo",
  "1y": "1y"
};

const TRACKED_MARKET_INDICES: TrackedMarketIndex[] = [
  {
    indexKey: "cn_sse",
    symbol: "000001.SS",
    region: "cn",
    nameZh: "上证综指",
    nameEn: "SSE Composite",
    isPrimary: true
  },
  {
    indexKey: "cn_csi300",
    symbol: "000300.SH",
    region: "cn",
    nameZh: "沪深300",
    nameEn: "CSI 300",
    isPrimary: false
  },
  {
    indexKey: "cn_szse",
    symbol: "399001.SZ",
    region: "cn",
    nameZh: "深证成指",
    nameEn: "SZSE Component",
    isPrimary: false
  },
  {
    indexKey: "hk_hsi",
    symbol: "^HSI",
    region: "hk",
    nameZh: "恒生指数",
    nameEn: "Hang Seng Index",
    isPrimary: true
  },
  {
    indexKey: "hk_hstech",
    symbol: "^HSTECH",
    region: "hk",
    nameZh: "恒生科技指数",
    nameEn: "Hang Seng Tech Index",
    isPrimary: false
  },
  {
    indexKey: "us_sp500",
    symbol: "^GSPC",
    region: "us",
    nameZh: "标普500",
    nameEn: "S&P 500",
    isPrimary: true
  },
  {
    indexKey: "us_nasdaq",
    symbol: "^IXIC",
    region: "us",
    nameZh: "纳斯达克综合指数",
    nameEn: "Nasdaq Composite",
    isPrimary: false
  },
  {
    indexKey: "us_dow",
    symbol: "^DJI",
    region: "us",
    nameZh: "道琼斯工业平均指数",
    nameEn: "Dow Jones Industrial Average",
    isPrimary: false
  }
];

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

async function fetchLatestMarketSnapshots(): Promise<MarketIndexSnapshot[]> {
  const items = await Promise.all(TRACKED_MARKET_INDICES.map((definition) => fetchLatestMarketSnapshot(definition)));
  return items.filter((item): item is MarketIndexSnapshot => item !== null);
}

async function fetchLatestMarketSnapshot(definition: TrackedMarketIndex): Promise<MarketIndexSnapshot | null> {
  const endpoint = buildYahooChartUrl(definition.symbol, "5d");

  try {
    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooChartPayload;
    const result = payload.chart?.result?.[0];
    const points = extractValidPoints(result);
    if (points.length < 2) {
      return null;
    }

    const latest = points[points.length - 1];
    const previous = points[points.length - 2];
    const changeAbs = latest.close - previous.close;
    const changePct = previous.close === 0 ? 0 : (changeAbs / previous.close) * 100;

    return {
      indexKey: definition.indexKey,
      symbol: definition.symbol,
      region: definition.region,
      nameZh: definition.nameZh,
      nameEn: definition.nameEn,
      close: latest.close,
      previousClose: previous.close,
      changeAbs,
      changePct,
      currency: result?.meta?.currency ?? guessCurrency(definition.region),
      quoteTimestamp: new Date(latest.timestamp * 1000).toISOString(),
      isPrimary: definition.isPrimary
    };
  } catch {
    return null;
  }
}

async function fetchMarketIndexHistorySeries(
  definition: TrackedMarketIndex,
  range: MarketIndexRange
): Promise<MarketIndexHistorySeries | null> {
  const endpoint = buildYahooChartUrl(definition.symbol, HISTORY_RANGE_MAP[range]);

  try {
    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooChartPayload;
    const result = payload.chart?.result?.[0];
    const points = extractValidPoints(result);
    if (points.length < 2) {
      return null;
    }

    const historyPoints: MarketIndexHistoryPoint[] = points.map((point, index) => ({
      tradingDate: toIsoDate(point.timestamp),
      close: point.close,
      changePct: index === 0 || points[index - 1].close === 0 ? 0 : ((point.close - points[index - 1].close) / points[index - 1].close) * 100
    }));

    return {
      indexKey: definition.indexKey,
      symbol: definition.symbol,
      region: definition.region,
      nameZh: definition.nameZh,
      nameEn: definition.nameEn,
      points: dedupeHistoryPoints(historyPoints)
    };
  } catch {
    return null;
  }
}

function resolveRequestedIndices(requestedIndexKeys: string[]): TrackedMarketIndex[] {
  if (requestedIndexKeys.length === 0) {
    return TRACKED_MARKET_INDICES.filter((item) => item.isPrimary);
  }

  const selected = requestedIndexKeys
    .map((indexKey) => TRACKED_MARKET_INDICES.find((item) => item.indexKey === indexKey) ?? null)
    .filter((item): item is TrackedMarketIndex => item !== null);

  return selected.length > 0 ? selected : TRACKED_MARKET_INDICES.filter((item) => item.isPrimary);
}

function buildYahooChartUrl(symbol: string, range: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
}

function extractValidPoints(
  result:
    | {
        timestamp?: number[];
        meta?: {
          currency?: string;
        };
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
          }>;
        };
      }
    | undefined
): Array<{ timestamp: number; close: number }> {
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const out: Array<{ timestamp: number; close: number }> = [];

  for (let index = 0; index < Math.min(timestamps.length, closes.length); index += 1) {
    const timestamp = timestamps[index];
    const close = closes[index];
    if (typeof timestamp !== "number" || typeof close !== "number" || !Number.isFinite(close)) {
      continue;
    }
    out.push({ timestamp, close });
  }

  return out;
}

function dedupeHistoryPoints(points: MarketIndexHistoryPoint[]): MarketIndexHistoryPoint[] {
  const latestByDate = new Map<string, MarketIndexHistoryPoint>();
  for (const point of points) {
    latestByDate.set(point.tradingDate, point);
  }

  return [...latestByDate.values()].sort((left, right) => left.tradingDate.localeCompare(right.tradingDate));
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

function compareSnapshots(left: MarketIndexSnapshot, right: MarketIndexSnapshot): number {
  const regionCompare = REGION_ORDER.indexOf(left.region) - REGION_ORDER.indexOf(right.region);
  if (regionCompare !== 0) {
    return regionCompare;
  }

  const leftOrder = TRACKED_MARKET_INDICES.findIndex((item) => item.indexKey === left.indexKey);
  const rightOrder = TRACKED_MARKET_INDICES.findIndex((item) => item.indexKey === right.indexKey);
  return leftOrder - rightOrder;
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
