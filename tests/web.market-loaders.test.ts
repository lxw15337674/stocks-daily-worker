import assert from "node:assert/strict";
import test from "node:test";

import type {
  MarketAiSummary,
  MarketIndexArchiveResponse,
  MarketIndexHistoryResponse,
  MarketIndexLatestResponse
} from "../packages/contracts/src/index.ts";
import {
  buildMarketPageSearch,
  getTodayMarketDate,
  loadHomeArchivedMarketPulse,
  loadHomeLiveMarketPulse,
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

function createArchive(date: string): MarketIndexArchiveResponse {
  return {
    snapshotDate: date,
    updatedAt: `${date}T08:00:00.000Z`,
    regions: []
  };
}

function createSummary(date: string): MarketAiSummary {
  return {
    summaryDate: date,
    region: "cn",
    summaryType: "intraday",
    summaryZh: "测试摘要",
    summaryEn: "Test summary",
    model: "gpt-4o-mini",
    snapshotCount: 3,
    sourceQuoteTimestamp: `${date}T07:59:00.000Z`,
    createdAt: `${date}T08:00:00.000Z`
  };
}

test("parseMarketIndexKeys filters unknown keys and falls back to defaults", () => {
  assert.deepEqual(parseMarketIndexKeys("cn_sse,hk_hscei,us_sp500,unknown,cn_sse"), ["cn_sse", "hk_hscei", "us_sp500"]);
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
  const archive = createArchive("2026-03-11");
  const summary = createSummary("2026-03-11");
  let latestSummaryCalled = false;
  let latestCalled = false;

  const result = await loadMarketPageData(
    {
      range: "1y",
      indexKeys: "cn_sse,us_sp500,invalid_key",
      summaryDate: "2026-03-11"
    },
    {
      fetchLatest: async () => {
        latestCalled = true;
        return latest;
      },
      fetchSnapshotByDate: async (date) => {
        assert.equal(date, "2026-03-11");
        return archive;
      },
      fetchHistory: async (indexKeys, range) => {
        assert.deepEqual(indexKeys, ["cn_sse", "us_sp500"]);
        assert.equal(range, "1y");
        return history;
      },
      fetchLatestIntradaySummaries: async () => {
        latestSummaryCalled = true;
        return [];
      },
      fetchFinalSummariesByDate: async (date) => {
        assert.equal(date, "2026-03-11");
        return [summary];
      }
    }
  );

  assert.equal(latestCalled, false);
  assert.equal(latestSummaryCalled, false);
  assert.equal(result.latest, archive);
  assert.equal(result.history, history);
  assert.equal(result.summary[0]?.summaryDate, "2026-03-11");
  assert.equal(result.snapshotVariant, "archive");
  assert.deepEqual(result.selectedIndexKeys, ["cn_sse", "us_sp500"]);
});

test("loadMarketPageData keeps live snapshot when the requested date is today", async () => {
  const latest = createLatest();
  const history = createHistory();
  const today = getTodayMarketDate();
  let snapshotCalled = false;

  const result = await loadMarketPageData(
    {
      summaryDate: today
    },
    {
      fetchLatest: async () => latest,
      fetchSnapshotByDate: async () => {
        snapshotCalled = true;
        return createArchive(today);
      },
      fetchHistory: async () => history,
      fetchLatestIntradaySummaries: async () => [],
      fetchFinalSummariesByDate: async (date) => [createSummary(date)]
    }
  );

  assert.equal(snapshotCalled, false);
  assert.equal(result.latest, latest);
  assert.equal(result.snapshotVariant, "live");
});

test("loadHomeLiveMarketPulse keeps only same-day summaries for homepage realtime mode", async () => {
  const latest = createLatest();
  const summary = createSummary("2026-03-11");
  let latestCalled = false;
  let summaryCalled = false;

  const result = await loadHomeLiveMarketPulse("2026-03-12", {
    fetchLatest: async () => {
      latestCalled = true;
      return latest;
    },
    fetchSnapshotByDate: async () => null,
    fetchHistory: async () => createHistory(),
    fetchLatestIntradaySummaries: async () => {
      summaryCalled = true;
      return [summary];
    },
    fetchFinalSummariesByDate: async () => []
  });

  assert.equal(latestCalled, true);
  assert.equal(summaryCalled, true);
  assert.equal(result.latest, latest);
  assert.deepEqual(result.summaries, []);
});

test("loadHomeArchivedMarketPulse fetches archived homepage market pulse data", async () => {
  const archive = createArchive("2026-03-12");
  const summary = createSummary("2026-03-12");

  const result = await loadHomeArchivedMarketPulse("2026-03-12", {
    fetchLatest: async () => createLatest(),
    fetchSnapshotByDate: async (date) => {
      assert.equal(date, "2026-03-12");
      return archive;
    },
    fetchHistory: async () => createHistory(),
    fetchLatestIntradaySummaries: async () => [],
    fetchFinalSummariesByDate: async (date) => {
      assert.equal(date, "2026-03-12");
      return [summary];
    }
  });

  assert.equal(result.latest, archive);
  assert.deepEqual(result.summaries, [summary]);
});

