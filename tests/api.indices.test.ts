import assert from "node:assert/strict";
import test from "node:test";

import {
  getLiveMarketIndicesHistory,
  getLiveMarketIndicesLatest
} from "../apps/api/src/modules/stocks/indices-live.ts";

const originalFetch = globalThis.fetch;

function toTimestamp(isoTime: string): number {
  return Math.floor(new Date(isoTime).getTime() / 1000);
}

type ChartOverrides = {
  timestamps?: number[];
  opens?: Array<number | null>;
  highs?: Array<number | null>;
  lows?: Array<number | null>;
  volumes?: Array<number | null>;
  meta?: {
    currency?: string;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  };
};

function createChartPayload(closes: number[], startDate = "2026-03-10T00:00:00Z", overrides: ChartOverrides = {}) {
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const timestampSeries = overrides.timestamps ?? closes.map((_, index) => startTimestamp + index * 24 * 60 * 60);
  const openSeries = overrides.opens ?? closes.map((close) => close - 1);
  const highSeries = overrides.highs ?? closes.map((close) => close + 1);
  const lowSeries = overrides.lows ?? closes.map((close) => close - 2);
  const volumeSeries = overrides.volumes ?? closes.map((_, index) => 1000 + index * 100);
  return {
    chart: {
      result: [
        {
          meta: {
            currency: overrides.meta?.currency ?? "USD",
            fiftyTwoWeekHigh: overrides.meta?.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: overrides.meta?.fiftyTwoWeekLow
          },
          timestamp: timestampSeries,
          indicators: {
            quote: [
              {
                open: openSeries,
                high: highSeries,
                low: lowSeries,
                close: closes,
                volume: volumeSeries
              }
            ]
          }
        }
      ]
    }
  };
}

function parseChartRequest(input: RequestInfo | URL): { symbol: string; range: string | null } | null {
  const requestUrl =
    typeof input === "string"
      ? new URL(input)
      : input instanceof URL
        ? input
        : new URL(input.url);
  if (!requestUrl.hostname.includes("finance.yahoo.com") || !requestUrl.pathname.includes("/v8/finance/chart/")) {
    return null;
  }
  const pathnameParts = requestUrl.pathname.split("/");
  const symbol = decodeURIComponent(pathnameParts[pathnameParts.length - 1] ?? "");
  const range = requestUrl.searchParams.get("range");
  return { symbol, range };
}

test("getLiveMarketIndicesLatest returns grouped region snapshots", async (t) => {
  globalThis.fetch = async () =>
    Response.json(
      createChartPayload([100, 105], "2026-03-10T00:00:00Z", {
        opens: [99, 100],
        highs: [101, 108],
        lows: [98, 99],
        volumes: [500, 700],
        meta: {
          fiftyTwoWeekHigh: 126.42,
          fiftyTwoWeekLow: 87.18
        }
      })
    );
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesLatest();

  assert.equal(result.regions.length, 3);
  assert.deepEqual(
    result.regions.map((region) => region.region),
    ["cn", "hk", "us"]
  );
  assert.equal(result.regions[0].items.length, 3);
  assert.equal(result.regions[1].items.length, 2);
  assert.equal(result.regions[2].items.length, 3);
  assert.equal(result.regions[0].items[0].indexKey, "cn_sse");
  assert.equal(result.regions[2].items[0].indexKey, "us_sp500");
  assert.equal(result.regions[0].items[0].price, 105);
  assert.equal(result.regions[0].items[0].previousClose, 100);
  assert.equal(result.regions[0].items[0].dayOpen, 100);
  assert.equal(result.regions[0].items[0].dayHigh, 108);
  assert.equal(result.regions[0].items[0].dayLow, 99);
  assert.equal(result.regions[0].items[0].dayVolume, null);
  assert.equal(result.regions[2].items[0].dayVolume, 700);
  assert.ok(result.regions[0].items[0].dayRangePct !== null);
  assert.ok(Math.abs((result.regions[0].items[0].dayRangePct ?? 0) - 9) < 1e-10);
  assert.equal(result.regions[0].items[0].fiftyTwoWeekHigh, 126.42);
  assert.equal(result.regions[0].items[0].fiftyTwoWeekLow, 87.18);
  assert.equal(result.updatedAt, new Date("2026-03-11T00:00:00.000Z").toISOString());
});

test("getLiveMarketIndicesLatest returns null for 52-week fields when Yahoo meta is missing", async (t) => {
  globalThis.fetch = async () =>
    Response.json(
      createChartPayload([100, 105], "2026-03-10T00:00:00Z", {
        opens: [99, 100],
        highs: [101, 108],
        lows: [98, 99],
        volumes: [500, 700]
      })
    );
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesLatest();
  const first = result.regions[0].items[0];
  assert.equal(first.fiftyTwoWeekHigh, null);
  assert.equal(first.fiftyTwoWeekLow, null);
});

test("getLiveMarketIndicesLatest keeps last trading-day move and latest-day metrics when same-day duplicate points exist", async (t) => {
  globalThis.fetch = async () =>
    Response.json(
      createChartPayload([100, 110, 110], "2026-03-10T00:00:00Z", {
        timestamps: [toTimestamp("2026-03-12T01:30:00Z"), toTimestamp("2026-03-13T01:30:00Z"), toTimestamp("2026-03-13T07:00:00Z")],
        opens: [98, 105, 109],
        highs: [101, 112, 113],
        lows: [97, 104, 108],
        volumes: [1000, 2000, 0]
      })
    );
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesLatest();
  const first = result.regions[0].items[0];
  const usFirst = result.regions[2].items[0];

  assert.equal(first.price, 110);
  assert.equal(first.previousClose, 100);
  assert.ok(first.changePct !== null);
  assert.ok(Math.abs(first.changePct - 10) < 1e-10);
  assert.equal(first.dayOpen, 109);
  assert.equal(first.dayHigh, 113);
  assert.equal(first.dayLow, 108);
  assert.equal(first.dayVolume, null);
  assert.equal(usFirst.dayVolume, 2000);
  assert.ok(first.dayRangePct !== null);
  assert.ok(Math.abs((first.dayRangePct ?? 0) - ((113 - 108) / 109) * 100) < 1e-10);
  assert.equal(first.quoteTimestamp, "2026-03-13T07:00:00.000Z");
  assert.equal(result.updatedAt, "2026-03-13T07:00:00.000Z");
});

test("getLiveMarketIndicesHistory filters invalid keys and returns normalized series points", async (t) => {
  globalThis.fetch = async () => Response.json(createChartPayload([100, 103, 107], "2026-03-01T00:00:00Z"));
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesHistory(["cn_sse", "invalid_key", "us_sp500"], "3m");

  assert.equal(result.range, "3m");
  assert.deepEqual(
    result.series.map((series) => series.indexKey),
    ["cn_sse", "us_sp500"]
  );
  assert.equal(result.series[0].points.length, 3);
  assert.deepEqual(Object.keys(result.series[0].points[0]).sort(), ["changePct", "close", "tradingDate"]);
  assert.equal(result.series[0].points[0].tradingDate, "2026-03-01");
  assert.equal(result.series[0].points[1].close, 103);
});

test("getLiveMarketIndicesHistory dedupes same-day points before computing daily change", async (t) => {
  globalThis.fetch = async () =>
    Response.json(
      createChartPayload(
        [95, 100, 110, 110],
        "2026-03-10T00:00:00Z",
        {
          timestamps: [
          toTimestamp("2026-03-11T01:30:00Z"),
          toTimestamp("2026-03-12T01:30:00Z"),
          toTimestamp("2026-03-13T01:30:00Z"),
          toTimestamp("2026-03-13T07:00:00Z")
          ]
        }
      )
    );
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesHistory(["cn_sse"], "3m");
  const points = result.series[0].points;

  assert.equal(points.length, 3);
  assert.deepEqual(
    points.map((point) => point.tradingDate),
    ["2026-03-11", "2026-03-12", "2026-03-13"]
  );
  assert.equal(points[0].changePct, 0);
  assert.ok(Math.abs(points[2].changePct - 10) < 1e-10);
});

test("getLiveMarketIndicesLatest uses Eastmoney day volume for CN/HK while keeping US volume from Yahoo", async (t) => {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const yahooRequest = parseChartRequest(input);
    if (yahooRequest) {
      return Response.json(
        createChartPayload([100, 105], "2026-03-12T00:00:00Z", {
          volumes: [111, 222]
        })
      );
    }

    if (url.includes("push2his.eastmoney.com")) {
      if (url.includes("secid=1.000001")) {
        return Response.json({ data: { klines: ["2026-03-13,1,1,1,1,792054764,0,0,0,0,0"] } });
      }
      if (url.includes("secid=1.000300")) {
        return Response.json({ data: { klines: ["2026-03-13,1,1,1,1,310772009,0,0,0,0,0"] } });
      }
      if (url.includes("secid=0.399001")) {
        return Response.json({ data: { klines: ["2026-03-13,1,1,1,1,774225691,0,0,0,0,0"] } });
      }
      if (url.includes("secid=100.HSI")) {
        return Response.json({ data: { klines: ["2026-03-13,1,1,1,1,19140206080,0,0,0,0,0"] } });
      }
      if (url.includes("secid=116.03032")) {
        return Response.json({ data: { klines: ["2026-03-13,1,1,1,1,19650803,0,0,0,0,0"] } });
      }
      return Response.json({ data: { klines: [] } });
    }

    return new Response("not found", { status: 404 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesLatest();
  const allItems = result.regions.flatMap((region) => region.items);
  const cnSse = allItems.find((item) => item.indexKey === "cn_sse");
  const hkHsi = allItems.find((item) => item.indexKey === "hk_hsi");
  const usSp500 = allItems.find((item) => item.indexKey === "us_sp500");

  assert.equal(cnSse?.dayVolume, 792054764);
  assert.equal(hkHsi?.dayVolume, 19140206080);
  assert.equal(usSp500?.dayVolume, 222);
});

test("getLiveMarketIndicesLatest falls back to Sina volume when Eastmoney is unavailable", async (t) => {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const yahooRequest = parseChartRequest(input);
    if (yahooRequest) {
      return Response.json(createChartPayload([100, 105], "2026-03-12T00:00:00Z"));
    }

    if (url.includes("push2his.eastmoney.com") && url.includes("secid=100.HSI")) {
      return new Response("upstream error", { status: 500 });
    }

    if (url.includes("hq.sinajs.cn/list=hkHSI")) {
      return new Response(
        'var hq_str_hkHSI="HSI,恒生指数,25583.550,25716.760,25697.170,25419.870,25465.600,-251.160,-0.977,0.00000,0.00000,246542129,19139018827,0.000,0.000,28056.100,19260.210,2026/03/13,16:08";',
        { status: 200 }
      );
    }

    if (url.includes("push2his.eastmoney.com")) {
      return Response.json({ data: { klines: ["2026-03-13,1,1,1,1,123456,0,0,0,0,0"] } });
    }

    return new Response("not found", { status: 404 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesLatest();
  const hkHsi = result.regions.flatMap((region) => region.items).find((item) => item.indexKey === "hk_hsi");
  assert.equal(hkHsi?.dayVolume, 19139018827);
});

test("getLiveMarketIndicesLatest uses corrected CSI300/HSTECH proxy symbols and returns non-null values", async (t) => {
  const requestedSymbols: string[] = [];
  globalThis.fetch = async (input) => {
    const chartRequest = parseChartRequest(input);
    if (!chartRequest) {
      return Response.json({ data: { klines: ["2026-03-13,1,1,1,1,123456,0,0,0,0,0"] } });
    }
    const { symbol } = chartRequest;
    requestedSymbols.push(symbol);

    if (symbol === "000300.SH" || symbol === "^HSTECH") {
      return new Response("{}", { status: 404 });
    }
    if (symbol === "000300.SS") {
      return Response.json(createChartPayload([4620, 4669.14], "2026-03-12T00:00:00Z"));
    }
    if (symbol === "3032.HK") {
      return Response.json(createChartPayload([4.88, 4.958], "2026-03-12T00:00:00Z"));
    }

    return Response.json(createChartPayload([100, 101], "2026-03-12T00:00:00Z"));
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesLatest();
  const csi300 = result.regions.flatMap((region) => region.items).find((item) => item.indexKey === "cn_csi300");
  const hstech = result.regions.flatMap((region) => region.items).find((item) => item.indexKey === "hk_hstech");

  assert.ok(csi300);
  assert.ok(hstech);
  assert.equal(csi300.symbol, "000300.SS");
  assert.equal(hstech.symbol, "3032.HK");
  assert.equal(hstech.nameZh, "恒生科技ETF（3032.HK）");
  assert.equal(hstech.nameEn, "Hang Seng Tech ETF (3032.HK)");
  assert.ok(csi300.price !== null && csi300.changePct !== null);
  assert.ok(hstech.price !== null && hstech.changePct !== null);
  assert.ok(requestedSymbols.includes("000300.SS"));
  assert.ok(requestedSymbols.includes("3032.HK"));
  assert.equal(requestedSymbols.includes("000300.SH"), false);
  assert.equal(requestedSymbols.includes("^HSTECH"), false);
});

test("getLiveMarketIndicesHistory for hk_hstech uses 3032.HK and returns a valid history series", async (t) => {
  const requestedSymbols: string[] = [];
  globalThis.fetch = async (input) => {
    const chartRequest = parseChartRequest(input);
    if (!chartRequest) {
      return new Response("{}", { status: 404 });
    }
    const { symbol, range } = chartRequest;
    requestedSymbols.push(symbol);

    if (symbol === "^HSTECH") {
      return new Response("{}", { status: 404 });
    }
    if (symbol === "3032.HK" && range === "1y") {
      return Response.json(createChartPayload([4.75, 4.86, 4.958], "2026-03-10T00:00:00Z"));
    }

    return new Response("{}", { status: 404 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesHistory(["hk_hstech"], "1y");

  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].indexKey, "hk_hstech");
  assert.equal(result.series[0].symbol, "3032.HK");
  assert.ok(result.series[0].points.length >= 2);
  assert.deepEqual(requestedSymbols, ["3032.HK"]);
});
