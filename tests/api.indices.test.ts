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

function createChartPayload(closes: number[], startDate = "2026-03-10T00:00:00Z", timestamps?: number[]) {
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const timestampSeries = timestamps ?? closes.map((_, index) => startTimestamp + index * 24 * 60 * 60);
  return {
    chart: {
      result: [
        {
          meta: {
            currency: "USD"
          },
          timestamp: timestampSeries,
          indicators: {
            quote: [
              {
                close: closes
              }
            ]
          }
        }
      ]
    }
  };
}

test("getLiveMarketIndicesLatest returns grouped region snapshots", async (t) => {
  globalThis.fetch = async () => Response.json(createChartPayload([100, 105]));
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
  assert.equal(result.updatedAt, new Date("2026-03-11T00:00:00.000Z").toISOString());
});

test("getLiveMarketIndicesLatest keeps last trading-day move when same-day duplicate points exist", async (t) => {
  globalThis.fetch = async () =>
    Response.json(
      createChartPayload(
        [100, 110, 110],
        "2026-03-10T00:00:00Z",
        [toTimestamp("2026-03-12T01:30:00Z"), toTimestamp("2026-03-13T01:30:00Z"), toTimestamp("2026-03-13T07:00:00Z")]
      )
    );
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getLiveMarketIndicesLatest();
  const first = result.regions[0].items[0];

  assert.equal(first.price, 110);
  assert.equal(first.previousClose, 100);
  assert.ok(first.changePct !== null);
  assert.ok(Math.abs(first.changePct - 10) < 1e-10);
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
        [
          toTimestamp("2026-03-11T01:30:00Z"),
          toTimestamp("2026-03-12T01:30:00Z"),
          toTimestamp("2026-03-13T01:30:00Z"),
          toTimestamp("2026-03-13T07:00:00Z")
        ]
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
