import type {
  MarketIndexHistoryPoint,
  MarketIndexHistoryResponse,
  MarketIndexHistorySeries,
  MarketIndexKey,
  MarketIndexLatestResponse,
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

export const REGION_ORDER: MarketRegion[] = ["cn", "hk", "us"];
const HISTORY_RANGE_MAP: Record<MarketIndexRange, string> = {
  "1m": "1mo",
  "3m": "3mo",
  "1y": "1y"
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

export async function getLiveMarketIndicesLatest(): Promise<MarketIndexLatestResponse> {
  const items = await fetchLatestMarketSnapshots();
  const updatedAt =
    items.length > 0
      ? [...items]
          .map((item) => item.quoteTimestamp)
          .sort((left, right) => right.localeCompare(left))[0] ?? null
      : null;

  return {
    updatedAt,
    regions: REGION_ORDER.map((region) => {
      const definitions = TRACKED_MARKET_INDICES.filter((item) => item.region === region);
      return {
        region,
        primaryIndexKey: definitions.find((item) => item.isPrimary)?.indexKey ?? definitions[0]?.indexKey ?? "",
        items: definitions.map((definition) => {
          const snapshot = items.find((item) => item.indexKey === definition.indexKey) ?? null;
          return {
            indexKey: definition.indexKey,
            symbol: definition.symbol,
            region: definition.region,
            nameZh: definition.nameZh,
            nameEn: definition.nameEn,
            price: snapshot?.close ?? null,
            previousClose: snapshot?.previousClose ?? null,
            changeAbs: snapshot?.changeAbs ?? null,
            changePct: snapshot?.changePct ?? null,
            currency: snapshot?.currency ?? null,
            quoteTimestamp: snapshot?.quoteTimestamp ?? null,
            isPrimary: definition.isPrimary
          };
        })
      };
    })
  };
}

export async function getLiveMarketIndicesHistory(
  requestedIndexKeys: string[],
  range: MarketIndexRange
): Promise<MarketIndexHistoryResponse> {
  const selected = resolveRequestedIndices(requestedIndexKeys);
  const series = (
    await Promise.all(selected.map((definition) => fetchMarketIndexHistorySeries(definition, range)))
  ).filter((item): item is MarketIndexHistorySeries => item !== null);

  return {
    range,
    series
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
