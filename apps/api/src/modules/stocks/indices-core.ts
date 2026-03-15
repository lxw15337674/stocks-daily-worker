import type {
  MarketIndexHistoryPoint,
  MarketIndexHistorySeries,
  MarketIndexKey,
  MarketIndexRange,
  MarketIndexSnapshot,
  MarketRegion
} from "@china-stocks/contracts";

export type TrackedMarketIndex = {
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
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type RawIndexPoint = {
  timestamp: number;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
};

export const REGION_ORDER: MarketRegion[] = ["cn", "hk", "us"];

const HISTORY_RANGE_MAP: Record<MarketIndexRange, string> = {
  "1m": "1mo",
  "3m": "3mo",
  "1y": "1y"
};

const EASTMONEY_SECID_BY_INDEX_KEY: Partial<Record<MarketIndexKey, string>> = {
  cn_sse: "1.000001",
  cn_csi300: "1.000300",
  cn_szse: "0.399001",
  hk_hsi: "100.HSI",
  hk_hstech: "116.03032"
};

const SINA_SYMBOL_BY_INDEX_KEY: Partial<Record<MarketIndexKey, string>> = {
  cn_sse: "sh000001",
  cn_csi300: "sh000300",
  cn_szse: "sz399001",
  hk_hsi: "hkHSI",
  hk_hstech: "hk03032"
};

export const TRACKED_MARKET_INDICES: TrackedMarketIndex[] = [
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
    symbol: "000300.SS",
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
    symbol: "3032.HK",
    region: "hk",
    nameZh: "恒生科技ETF（3032.HK）",
    nameEn: "Hang Seng Tech ETF (3032.HK)",
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

export async function fetchLatestMarketSnapshots(): Promise<MarketIndexSnapshot[]> {
  const items = await Promise.all(TRACKED_MARKET_INDICES.map((definition) => fetchLatestMarketSnapshot(definition)));
  return items.filter((item): item is MarketIndexSnapshot => item !== null);
}

export async function fetchLatestMarketSnapshot(definition: TrackedMarketIndex): Promise<MarketIndexSnapshot | null> {
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
    const points = dedupeDailyPoints(extractValidPoints(result));
    if (points.length < 2) {
      return null;
    }

    const latest = points[points.length - 1];
    const previous = points[points.length - 2];
    const changeAbs = latest.close - previous.close;
    const changePct = previous.close === 0 ? 0 : (changeAbs / previous.close) * 100;

    const dayVolume = await resolveDayVolume(definition, latest.volume, toIsoDate(latest.timestamp));
    const fiftyTwoWeekHigh = normalizeOptionalNumber(result?.meta?.fiftyTwoWeekHigh);
    const fiftyTwoWeekLow = normalizeOptionalNumber(result?.meta?.fiftyTwoWeekLow);

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
      dayOpen: latest.open,
      dayHigh: latest.high,
      dayLow: latest.low,
      dayVolume,
      dayRangePct: calculateDayRangePct(latest.open, latest.high, latest.low),
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      currency: result?.meta?.currency ?? guessCurrency(definition.region),
      quoteTimestamp: new Date(latest.timestamp * 1000).toISOString(),
      isPrimary: definition.isPrimary
    };
  } catch {
    return null;
  }
}

export async function fetchMarketIndexHistorySeries(
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
    const points = dedupeDailyPoints(extractValidPoints(result));
    if (points.length < 2) {
      return null;
    }

    const historyPoints: MarketIndexHistoryPoint[] = points.map((point, index) => {
      const previous = points[index - 1];
      return {
        tradingDate: toIsoDate(point.timestamp),
        close: point.close,
        changePct: index === 0 || !previous || previous.close === 0 ? 0 : ((point.close - previous.close) / previous.close) * 100
      };
    });

    return {
      indexKey: definition.indexKey,
      symbol: definition.symbol,
      region: definition.region,
      nameZh: definition.nameZh,
      nameEn: definition.nameEn,
      points: historyPoints
    };
  } catch {
    return null;
  }
}

export function resolveRequestedIndices(requestedIndexKeys: string[]): TrackedMarketIndex[] {
  if (requestedIndexKeys.length === 0) {
    return TRACKED_MARKET_INDICES.filter((item) => item.isPrimary);
  }

  const selected = requestedIndexKeys
    .map((indexKey) => TRACKED_MARKET_INDICES.find((item) => item.indexKey === indexKey) ?? null)
    .filter((item): item is TrackedMarketIndex => item !== null);

  return selected.length > 0 ? selected : TRACKED_MARKET_INDICES.filter((item) => item.isPrimary);
}

export function compareSnapshots(left: MarketIndexSnapshot, right: MarketIndexSnapshot): number {
  const regionCompare = REGION_ORDER.indexOf(left.region) - REGION_ORDER.indexOf(right.region);
  if (regionCompare !== 0) {
    return regionCompare;
  }

  const leftOrder = TRACKED_MARKET_INDICES.findIndex((item) => item.indexKey === left.indexKey);
  const rightOrder = TRACKED_MARKET_INDICES.findIndex((item) => item.indexKey === right.indexKey);
  return leftOrder - rightOrder;
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
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }
    | undefined
): RawIndexPoint[] {
  const timestamps = result?.timestamp ?? [];
  const opens = result?.indicators?.quote?.[0]?.open ?? [];
  const highs = result?.indicators?.quote?.[0]?.high ?? [];
  const lows = result?.indicators?.quote?.[0]?.low ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const volumes = result?.indicators?.quote?.[0]?.volume ?? [];
  const out: RawIndexPoint[] = [];

  for (let index = 0; index < Math.min(timestamps.length, closes.length); index += 1) {
    const timestamp = timestamps[index];
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = closes[index];
    const volume = volumes[index];
    if (typeof timestamp !== "number" || typeof close !== "number" || !Number.isFinite(close)) {
      continue;
    }
    out.push({
      timestamp,
      close,
      open: typeof open === "number" && Number.isFinite(open) ? open : null,
      high: typeof high === "number" && Number.isFinite(high) ? high : null,
      low: typeof low === "number" && Number.isFinite(low) ? low : null,
      volume: typeof volume === "number" && Number.isFinite(volume) ? volume : null
    });
  }

  return out;
}

function dedupeDailyPoints(points: RawIndexPoint[]): RawIndexPoint[] {
  const pointsByDate = new Map<string, RawIndexPoint[]>();
  for (const point of points) {
    const tradingDate = toIsoDate(point.timestamp);
    const existing = pointsByDate.get(tradingDate) ?? [];
    existing.push(point);
    pointsByDate.set(tradingDate, existing);
  }

  return [...pointsByDate.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([, dailyPoints]) => {
      const sorted = [...dailyPoints].sort((left, right) => left.timestamp - right.timestamp);
      const latest = sorted[sorted.length - 1];
      const latestPositiveVolume = [...sorted]
        .reverse()
        .find((point) => point.volume !== null && Number.isFinite(point.volume) && point.volume > 0);

      return {
        ...latest,
        // Yahoo can append a same-day duplicate point after close with volume=0.
        // Keep the latest OHLC/close timestamp but preserve the day's last valid positive volume.
        volume: latestPositiveVolume?.volume ?? latest.volume
      };
    });
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

function toIsoDate(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}

function normalizeDayVolume(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

async function resolveDayVolume(
  definition: TrackedMarketIndex,
  yahooVolume: number | null,
  tradingDate: string
): Promise<number | null> {
  if (definition.region === "us") {
    return normalizeDayVolume(yahooVolume);
  }

  const external = await fetchCnHkStableDayVolume(definition.indexKey, tradingDate);
  if (external !== null) {
    return external;
  }

  // CN/HK fallback policy: avoid exposing potentially misleading Yahoo volume.
  return null;
}

async function fetchCnHkStableDayVolume(indexKey: MarketIndexKey, tradingDate: string): Promise<number | null> {
  const eastmoneySecid = EASTMONEY_SECID_BY_INDEX_KEY[indexKey];
  if (eastmoneySecid) {
    const eastmoneyVolume = await fetchEastmoneyDayVolume(eastmoneySecid, tradingDate);
    if (eastmoneyVolume !== null) {
      return eastmoneyVolume;
    }
  }

  const sinaSymbol = SINA_SYMBOL_BY_INDEX_KEY[indexKey];
  if (!sinaSymbol) {
    return null;
  }
  return fetchSinaLatestVolume(indexKey, sinaSymbol);
}

async function fetchEastmoneyDayVolume(secid: string, tradingDate: string): Promise<number | null> {
  const day = tradingDate.replaceAll("-", "");
  const endpoint = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(
    secid
  )}&klt=101&fqt=0&beg=${day}&end=${day}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: {
        klines?: string[];
      };
    };
    const kline = payload.data?.klines?.[0];
    if (!kline) {
      return null;
    }

    const parts = kline.split(",");
    const volume = Number(parts[5]);
    return normalizeDayVolume(Number.isFinite(volume) ? volume : null);
  } catch {
    return null;
  }
}

async function fetchSinaLatestVolume(indexKey: MarketIndexKey, symbol: string): Promise<number | null> {
  const endpoint = `https://hq.sinajs.cn/list=${encodeURIComponent(symbol)}`;
  try {
    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: "https://finance.sina.com.cn"
      }
    });
    if (!response.ok) {
      return null;
    }

    const content = await response.text();
    const match = content.match(/="([^"]*)"/);
    if (!match) {
      return null;
    }
    const fields = match[1]?.split(",") ?? [];
    const normalized = normalizeSinaVolume(indexKey, fields);
    return normalizeDayVolume(normalized);
  } catch {
    return null;
  }
}

function normalizeSinaVolume(indexKey: MarketIndexKey, fields: string[]): number | null {
  if (indexKey === "hk_hsi" || indexKey === "hk_hstech") {
    return parseNumericField(fields[12]);
  }

  if (indexKey === "cn_sse" || indexKey === "cn_csi300") {
    return parseNumericField(fields[8]);
  }

  if (indexKey === "cn_szse") {
    const raw = parseNumericField(fields[8]);
    if (raw === null) {
      return null;
    }
    // Sina's SZ index volume field is reported about 100x Eastmoney's day-kline scale.
    return raw / 100;
  }

  return null;
}

function parseNumericField(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function normalizeOptionalNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function calculateDayRangePct(open: number | null, high: number | null, low: number | null): number | null {
  if (open === null || high === null || low === null || open <= 0) {
    return null;
  }
  return ((high - low) / open) * 100;
}
