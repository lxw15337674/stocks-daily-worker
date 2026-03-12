export interface CryptoMacroEnv {
  DB?: D1Database;
}

type MacroIndicatorKey = "fear_and_greed" | "btc_dominance";

type MacroUnit = "index" | "percent";
type MacroStatus = "available" | "stale" | "unavailable";
type MacroRegimeCode = "risk_on" | "risk_off" | "btc_defensive" | "alt_rotation" | "rangebound";

type MacroObservationInput = {
  indicatorKey: MacroIndicatorKey;
  assetCode?: string | null;
  metricValue: number | null;
  valueText?: string | null;
  unit: MacroUnit;
  classification?: string | null;
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  fetchedAt: string;
  metaJson?: string | null;
};

type MacroObservationRow = {
  indicatorKey: MacroIndicatorKey;
  assetCode: string;
  metricValue: number | null;
  valueText: string | null;
  unit: MacroUnit;
  classification: string | null;
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  fetchedAt: string;
  metaJson: string | null;
};

type MacroObservationListRow = Omit<MacroObservationRow, "metaJson">;

export type MacroIndicatorSnapshot = {
  key: MacroIndicatorKey;
  assetCode: string | null;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  unit: MacroUnit;
  classification: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  asOf: string | null;
  fetchedAt: string | null;
  status: MacroStatus;
};

export type MacroRegimeSnapshot = {
  code: MacroRegimeCode;
  labelZh: string;
  labelEn: string;
  summaryZh: string;
  summaryEn: string;
};

export type CryptoMacroSnapshot = {
  asOf: string | null;
  refreshedAt: string | null;
  regime: MacroRegimeSnapshot;
  fearGreed: MacroIndicatorSnapshot;
  btcDominance: MacroIndicatorSnapshot;
};

export type CryptoMacroAdminObservation = {
  indicatorKey: MacroIndicatorKey;
  assetCode: string | null;
  metricValue: number | null;
  valueText: string | null;
  unit: MacroUnit;
  classification: string | null;
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  fetchedAt: string;
};

export type CryptoMacroAdminOverview = {
  snapshot: CryptoMacroSnapshot;
  recentObservations: CryptoMacroAdminObservation[];
};

const FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=2";
const FEAR_GREED_SOURCE_URL = "https://alternative.me/crypto/fear-and-greed-index/";
const ALTERNATIVE_GLOBAL_URL = "https://api.alternative.me/v2/global/";
const ALTERNATIVE_GLOBAL_SOURCE_URL = "https://alternative.me/crypto/api/";
const FREE_FETCH_TIMEOUT_MS = 7000;
const FEAR_GREED_REFRESH_MS = 6 * 60 * 60 * 1000;
const BTC_DOMINANCE_REFRESH_MS = 3 * 60 * 60 * 1000;
const STALE_MULTIPLIER = 2.5;
const EMPTY_INDICATOR: MacroIndicatorSnapshot = {
  key: "fear_and_greed",
  assetCode: null,
  value: null,
  previousValue: null,
  change: null,
  unit: "index",
  classification: null,
  sourceName: null,
  sourceUrl: null,
  asOf: null,
  fetchedAt: null,
  status: "unavailable"
};

export function getCryptoMacroSchemaStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS crypto_macro_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicator_key TEXT NOT NULL,
      asset_code TEXT NOT NULL DEFAULT '',
      metric_value REAL,
      value_text TEXT,
      unit TEXT NOT NULL,
      classification TEXT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      meta_json TEXT
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_macro_observations_unique ON crypto_macro_observations(indicator_key, asset_code, observed_at)",
    "CREATE INDEX IF NOT EXISTS idx_crypto_macro_observations_lookup ON crypto_macro_observations(indicator_key, asset_code, observed_at DESC)"
  ];
}

export async function refreshCryptoMacroSnapshot(
  env: CryptoMacroEnv,
  options?: {
    force?: boolean;
    now?: Date;
  }
): Promise<void> {
  if (!env.DB) {
    return;
  }

  const now = options?.now ?? new Date();
  const fetchedAt = now.toISOString();
  const latestByKey = await getLatestObservedAtByIndicator(env.DB);
  const shouldRefreshFearGreed = options?.force || isIndicatorStale(latestByKey.get("fear_and_greed") ?? null, FEAR_GREED_REFRESH_MS, now);
  const shouldRefreshBtcDominance =
    options?.force || isIndicatorStale(latestByKey.get("btc_dominance") ?? null, BTC_DOMINANCE_REFRESH_MS, now);

  if (!shouldRefreshFearGreed && !shouldRefreshBtcDominance) {
    return;
  }

  const writes: MacroObservationInput[] = [];
  const freeFetches: Array<Promise<MacroObservationInput | null>> = [];

  if (shouldRefreshFearGreed) {
    freeFetches.push(fetchFearGreedObservation(fetchedAt));
  }

  if (shouldRefreshBtcDominance) {
    freeFetches.push(fetchBtcDominanceObservation(fetchedAt));
  }

  const freeResults = await Promise.all(freeFetches);
  for (const item of freeResults) {
    if (item) {
      writes.push(item);
    }
  }

  for (const record of writes) {
    await insertMacroObservation(env.DB, record);
  }
}

export async function getLatestCryptoMacroSnapshot(db: D1Database): Promise<CryptoMacroSnapshot> {
  return getCryptoMacroSnapshotForBoundary(db, null);
}

export async function getReportDateCryptoMacroSnapshot(db: D1Database, reportDate: string): Promise<CryptoMacroSnapshot> {
  const boundary = new Date(`${reportDate}T23:59:59.999Z`).toISOString();
  return getCryptoMacroSnapshotForBoundary(db, boundary);
}

export async function getCryptoMacroAdminOverview(env: CryptoMacroEnv): Promise<CryptoMacroAdminOverview> {
  if (!env.DB) {
    return {
      snapshot: createEmptyCryptoMacroSnapshot(),
      recentObservations: []
    };
  }

  const [snapshot, recentObservations] = await Promise.all([
    getLatestCryptoMacroSnapshot(env.DB),
    listRecentCryptoMacroObservations(env.DB, 12)
  ]);

  return {
    snapshot,
    recentObservations
  };
}

export function createEmptyCryptoMacroSnapshot(): CryptoMacroSnapshot {
  const regime = buildMacroRegime(null, null);
  return {
    asOf: null,
    refreshedAt: null,
    regime,
    fearGreed: { ...EMPTY_INDICATOR, key: "fear_and_greed" },
    btcDominance: { ...EMPTY_INDICATOR, key: "btc_dominance", unit: "percent" }
  };
}

async function getCryptoMacroSnapshotForBoundary(db: D1Database, boundaryIso: string | null): Promise<CryptoMacroSnapshot> {
  const freshnessReferenceIso = boundaryIso ?? new Date().toISOString();
  const [fearGreedRows, btcDominanceRows] = await Promise.all([
    listRecentMacroRows(db, "fear_and_greed", "", boundaryIso, 2),
    listRecentMacroRows(db, "btc_dominance", "", boundaryIso, 2)
  ]);

  const fearGreed = buildIndicatorSnapshot("fear_and_greed", null, "index", FEAR_GREED_REFRESH_MS, fearGreedRows, freshnessReferenceIso);
  const btcDominance = buildIndicatorSnapshot("btc_dominance", null, "percent", BTC_DOMINANCE_REFRESH_MS, btcDominanceRows, freshnessReferenceIso);

  const asOf = maxIso([fearGreed.asOf, btcDominance.asOf]);
  const refreshedAt = maxIso([fearGreed.fetchedAt, btcDominance.fetchedAt]);
  const regime = buildMacroRegime(fearGreed, btcDominance);

  return {
    asOf,
    refreshedAt,
    regime,
    fearGreed,
    btcDominance
  };
}

async function fetchFearGreedObservation(fetchedAt: string): Promise<MacroObservationInput | null> {
  const payload = await fetchJsonWithTimeout<{
    data?: Array<{
      value?: string;
      value_classification?: string;
      timestamp?: string;
    }>;
  }>(FEAR_GREED_URL, FREE_FETCH_TIMEOUT_MS);
  const latest = payload?.data?.[0];
  if (!latest?.timestamp) {
    return null;
  }

  const observedAt = toIsoFromUnixSeconds(latest.timestamp);
  const metricValue = toFiniteNumber(latest.value);
  if (!observedAt || metricValue === null) {
    return null;
  }

  return {
    indicatorKey: "fear_and_greed",
    metricValue,
    valueText: latest.value ?? String(metricValue),
    unit: "index",
    classification: latest.value_classification?.trim() || null,
    sourceName: "Alternative.me",
    sourceUrl: FEAR_GREED_SOURCE_URL,
    observedAt,
    fetchedAt,
    metaJson: null
  };
}

async function fetchBtcDominanceObservation(fetchedAt: string): Promise<MacroObservationInput | null> {
  const payload = await fetchJsonWithTimeout<{
    data?: {
      bitcoin_percentage_of_market_cap?: number | string;
      last_updated?: number | string;
    };
  }>(ALTERNATIVE_GLOBAL_URL, FREE_FETCH_TIMEOUT_MS);

  const dominance = toFiniteNumber(payload?.data?.bitcoin_percentage_of_market_cap ?? null);
  if (!Number.isFinite(dominance)) {
    return null;
  }

  const observedAt = payload?.data?.last_updated ? toIsoFromUnixSeconds(payload.data.last_updated) : fetchedAt;
  return {
    indicatorKey: "btc_dominance",
    metricValue: dominance,
    valueText: null,
    unit: "percent",
    classification: null,
    sourceName: "Alternative.me",
    sourceUrl: ALTERNATIVE_GLOBAL_SOURCE_URL,
    observedAt: observedAt ?? fetchedAt,
    fetchedAt,
    metaJson: null
  };
}

async function insertMacroObservation(db: D1Database, input: MacroObservationInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO crypto_macro_observations (
        indicator_key,
        asset_code,
        metric_value,
        value_text,
        unit,
        classification,
        source_name,
        source_url,
        observed_at,
        fetched_at,
        meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(indicator_key, asset_code, observed_at) DO UPDATE SET
        metric_value = excluded.metric_value,
        value_text = excluded.value_text,
        unit = excluded.unit,
        classification = excluded.classification,
        source_name = excluded.source_name,
        source_url = excluded.source_url,
        fetched_at = excluded.fetched_at,
        meta_json = excluded.meta_json`
    )
    .bind(
      input.indicatorKey,
      input.assetCode?.trim().toUpperCase() ?? "",
      input.metricValue,
      input.valueText ?? null,
      input.unit,
      input.classification ?? null,
      input.sourceName,
      input.sourceUrl,
      input.observedAt,
      input.fetchedAt,
      input.metaJson ?? null
    )
    .run();
}

async function listRecentMacroRows(
  db: D1Database,
  indicatorKey: MacroIndicatorKey,
  assetCode: string,
  boundaryIso: string | null,
  limit: number
): Promise<MacroObservationRow[]> {
  const boundaryClause = boundaryIso ? "AND observed_at <= ?" : "";
  const result = await db
    .prepare(
      `SELECT
        indicator_key AS indicatorKey,
        asset_code AS assetCode,
        metric_value AS metricValue,
        value_text AS valueText,
        unit AS unit,
        classification AS classification,
        source_name AS sourceName,
        source_url AS sourceUrl,
        observed_at AS observedAt,
        fetched_at AS fetchedAt,
        meta_json AS metaJson
      FROM crypto_macro_observations
      WHERE indicator_key = ?
        AND asset_code = ?
        ${boundaryClause}
      ORDER BY observed_at DESC
      LIMIT ?`
    )
    .bind(...(boundaryIso ? [indicatorKey, assetCode, boundaryIso, limit] : [indicatorKey, assetCode, limit]))
    .all<MacroObservationRow>();

  return result.results ?? [];
}

async function getLatestObservedAtByIndicator(db: D1Database): Promise<Map<string, string>> {
  const result = await db
    .prepare(
      `SELECT
        indicator_key AS indicatorKey,
        MAX(observed_at) AS observedAt
      FROM crypto_macro_observations
      GROUP BY indicator_key`
    )
    .all<{ indicatorKey: string; observedAt: string | null }>();

  const out = new Map<string, string>();
  for (const row of result.results ?? []) {
    if (row.observedAt) {
      out.set(row.indicatorKey, row.observedAt);
    }
  }
  return out;
}

async function listRecentCryptoMacroObservations(
  db: D1Database,
  limit: number
): Promise<CryptoMacroAdminObservation[]> {
  const result = await db
    .prepare(
      `SELECT
        indicator_key AS indicatorKey,
        asset_code AS assetCode,
        metric_value AS metricValue,
        value_text AS valueText,
        unit AS unit,
        classification AS classification,
        source_name AS sourceName,
        source_url AS sourceUrl,
        observed_at AS observedAt,
        fetched_at AS fetchedAt
      FROM crypto_macro_observations
      ORDER BY observed_at DESC, id DESC
      LIMIT ?`
    )
    .bind(limit)
    .all<MacroObservationListRow>();

  return (result.results ?? []).map((row) => ({
    indicatorKey: row.indicatorKey,
    assetCode: row.assetCode || null,
    metricValue: row.metricValue === null ? null : Number(row.metricValue),
    valueText: row.valueText ?? null,
    unit: row.unit,
    classification: row.classification ?? null,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    observedAt: row.observedAt,
    fetchedAt: row.fetchedAt
  }));
}

function buildIndicatorSnapshot(
  key: MacroIndicatorKey,
  assetCode: string | null,
  unit: MacroUnit,
  refreshMs: number,
  rows: MacroObservationRow[],
  freshnessReferenceIso: string
): MacroIndicatorSnapshot {
  const latest = rows[0] ?? null;
  const previous = rows[1] ?? null;
  if (!latest) {
    return {
      ...EMPTY_INDICATOR,
      key,
      assetCode,
      unit
    };
  }

  const latestObserved = Date.parse(latest.observedAt);
  const freshnessReference = Date.parse(freshnessReferenceIso);
  const staleThreshold = refreshMs * STALE_MULTIPLIER;
  const status: MacroStatus =
    Number.isFinite(latestObserved) && Number.isFinite(freshnessReference) && freshnessReference - latestObserved > staleThreshold
      ? "stale"
      : "available";

  const latestValue = latest.metricValue === null ? null : Number(latest.metricValue);
  const previousValue = previous?.metricValue === null || previous?.metricValue === undefined ? null : Number(previous.metricValue);

  return {
    key,
    assetCode,
    value: latestValue,
    previousValue,
    change: latestValue !== null && previousValue !== null ? latestValue - previousValue : null,
    unit,
    classification: latest.classification ?? null,
    sourceName: latest.sourceName,
    sourceUrl: latest.sourceUrl,
    asOf: latest.observedAt,
    fetchedAt: latest.fetchedAt,
    status
  };
}

function buildMacroRegime(
  fearGreed: Pick<MacroIndicatorSnapshot, "value" | "change" | "status"> | null,
  btcDominance: Pick<MacroIndicatorSnapshot, "value" | "change" | "status"> | null
): MacroRegimeSnapshot {
  const sentiment = fearGreed?.status === "unavailable" ? null : fearGreed?.value ?? null;
  const dominance = btcDominance?.status === "unavailable" ? null : btcDominance?.value ?? null;
  const dominanceChange = btcDominance?.change ?? null;

  if (sentiment !== null && sentiment <= 35 && (dominanceChange === null || dominanceChange >= 0)) {
    return {
      code: "risk_off",
      labelZh: "避险",
      labelEn: "Risk-Off",
      summaryZh: "情绪偏冷，资金更倾向防守。优先观察抛压释放和流动性是否回暖。",
      summaryEn: "Sentiment is cold and positioning is defensive. Watch for selling pressure and liquidity stabilization."
    };
  }

  if (sentiment !== null && sentiment >= 60 && dominance !== null && dominance >= 58) {
    return {
      code: "risk_on",
      labelZh: "风险偏好回升",
      labelEn: "Risk-On",
      summaryZh: "市场风险偏好回升，主流币承接较强，同时交易所抛压没有明显走高。",
      summaryEn: "Risk appetite is improving, large caps are absorbing flow, and exchange sell pressure is not rising."
    };
  }

  if (dominance !== null && dominanceChange !== null && dominanceChange >= 0.35) {
    return {
      code: "btc_defensive",
      labelZh: "比特币防守",
      labelEn: "BTC Defensive",
      summaryZh: "BTC 市占率在抬升，资金偏向回流龙头，山寨扩散暂时偏弱。",
      summaryEn: "BTC dominance is climbing, capital is rotating back into the leader, and alt breadth is softer."
    };
  }

  if (sentiment !== null && sentiment >= 55 && dominanceChange !== null && dominanceChange <= -0.35) {
    return {
      code: "alt_rotation",
      labelZh: "山寨扩散",
      labelEn: "Alt Rotation",
      summaryZh: "情绪偏暖且 BTC 市占率回落，说明风险偏好正在向非 BTC 资产扩散。",
      summaryEn: "Sentiment is constructive while BTC dominance is fading, pointing to broader risk rotation into alts."
    };
  }

  return {
    code: "rangebound",
    labelZh: "震荡",
    labelEn: "Rangebound",
    summaryZh: "宏观信号暂未形成一致方向，市场更像区间震荡而不是单边趋势。",
    summaryEn: "Macro signals are mixed, so the market looks rangebound rather than trend-persistent."
  };
}

function isIndicatorStale(observedAt: string | null, refreshMs: number, now: Date): boolean {
  if (!observedAt) {
    return true;
  }
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return now.getTime() - timestamp >= refreshMs;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "market-dailies-worker/1.0"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function toIsoFromUnixSeconds(value: string | number): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

function toFiniteNumber(value: string | number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maxIso(values: Array<string | null>): string | null {
  const valid = values
    .map((item) => (item ? Date.parse(item) : Number.NaN))
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => b - a);
  if (valid.length === 0) {
    return null;
  }
  return new Date(valid[0]).toISOString();
}
