import assert from "node:assert/strict";
import test from "node:test";

import type { MarketAiSummary, MarketIndexHistoryResponse, MarketIndexLatestResponse } from "../packages/contracts/src/index.ts";
import {
  buildMarketPageSearch,
  loadHomeMarketPulse,
  loadMarketPageData,
  parseMarketIndexKeys,
  resolveMarketIndexRange
} from "../apps/web/lib/stocks-market-core.ts";

function createLatest(): MarketIndexLatestResponse {
  return {
    updatedAt: "2026-03-12T08:00:00.000Z",
    regions: []
  };
}

function createHistory(): MarketIndexHistoryResponse {
  return {
    range: "1y",
    series: []
  };
}

function createSummary(date: string): MarketAiSummary {
  return {
    summaryDate: date,
    scope: "global_indices",
    summaryZh: "测试摘要",
    summaryEn: "Test summary",
    model: "gpt-4o-mini",
    snapshotCount: 3,
    createdAt: `${date}T08:00:00.000Z`
  };
}

test("parseMarketIndexKeys filters unknown keys and falls back to defaults", () => {
  assert.deepEqual(parseMarketIndexKeys("cn_sse,us_sp500,unknown,cn_sse"), ["cn_sse", "us_sp500"]);
  assert.deepEqual(parseMarketIndexKeys(undefined), ["cn_sse", "hk_hsi", "us_sp500"]);
  assert.equal(resolveMarketIndexRange("bad"), "3m");
});

test("buildMarketPageSearch serializes a shareable query state", () => {
  const query = new URLSearchParams(
    buildMarketPageSearch({
      range: "1y",
      indexKeys: ["cn_sse", "us_sp500"],
      summaryDate: "2026-03-11"
    })
  );

  assert.equal(query.get("range"), "1y");
  assert.equal(query.get("indexKeys"), "cn_sse,us_sp500");
  assert.equal(query.get("summaryDate"), "2026-03-11");
});

test("loadMarketPageData drives market page server fetches from URL state", async () => {
  const latest = createLatest();
  const history = createHistory();
  const summary = createSummary("2026-03-11");
  let latestSummaryCalled = false;

  const result = await loadMarketPageData(
    {
      range: "1y",
      indexKeys: "cn_sse,us_sp500,invalid_key",
      summaryDate: "2026-03-11"
    },
    {
      fetchLatest: async () => latest,
      fetchHistory: async (indexKeys, range) => {
        assert.deepEqual(indexKeys, ["cn_sse", "us_sp500"]);
        assert.equal(range, "1y");
        return history;
      },
      fetchLatestSummary: async () => {
        latestSummaryCalled = true;
        return null;
      },
      fetchSummaryByDate: async (date) => {
        assert.equal(date, "2026-03-11");
        return summary;
      }
    }
  );

  assert.equal(latestSummaryCalled, false);
  assert.equal(result.latest, latest);
  assert.equal(result.history, history);
  assert.equal(result.summary?.summaryDate, "2026-03-11");
  assert.deepEqual(result.selectedIndexKeys, ["cn_sse", "us_sp500"]);
});

test("loadHomeMarketPulse fetches homepage market pulse data", async () => {
  const latest = createLatest();
  const summary = createSummary("2026-03-12");
  let latestCalled = false;
  let summaryCalled = false;

  const result = await loadHomeMarketPulse({
    fetchLatest: async () => {
      latestCalled = true;
      return latest;
    },
    fetchHistory: async () => createHistory(),
    fetchLatestSummary: async () => {
      summaryCalled = true;
      return summary;
    },
    fetchSummaryByDate: async () => null
  });

  assert.equal(latestCalled, true);
  assert.equal(summaryCalled, true);
  assert.equal(result.latest, latest);
  assert.equal(result.summary, summary);
});
