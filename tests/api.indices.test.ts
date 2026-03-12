import assert from "node:assert/strict";
import test from "node:test";

import {
  getLiveMarketIndicesHistory,
  getLiveMarketIndicesLatest
} from "../apps/api/src/modules/stocks/indices-live.ts";

const originalFetch = globalThis.fetch;

function createChartPayload(closes: number[], startDate = "2026-03-10T00:00:00Z") {
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  return {
    chart: {
      result: [
        {
          meta: {
            currency: "USD"
          },
          timestamp: closes.map((_, index) => startTimestamp + index * 24 * 60 * 60),
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
