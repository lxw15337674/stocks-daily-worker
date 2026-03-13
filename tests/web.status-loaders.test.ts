import assert from "node:assert/strict";
import test from "node:test";

import type { MarketAiSummary, ReportListItem, SchedulerStatusResponse } from "../packages/contracts/src/index.ts";
import type { CryptoMacroSnapshot, DailyReport, MarketNewsItem } from "../apps/web/lib/crypto/types.ts";
import { buildPlatformStatusPageData, normalizeSchedulerStatusResponse } from "../apps/web/lib/platform-status-core.ts";

function createSchedulerStatus(): SchedulerStatusResponse {
  return {
    generatedAt: "2026-03-13T10:30:00.000Z",
    retentionDays: 14,
    jobs: [
      {
        jobKey: "stocks_daily_report",
        latest: {
          attemptId: "a",
          jobKey: "stocks_daily_report",
          triggerType: "cron",
          triggerLabel: "0 23 * * 1-5",
          scheduledFor: "2026-03-13T23:00:00.000Z",
          startedAt: "2026-03-13T23:00:01.000Z",
          finishedAt: "2026-03-13T23:00:06.000Z",
          durationMs: 5000,
          status: "success",
          message: "done",
          errorMessage: null,
          metadata: null
        }
      },
      { jobKey: "market_indices_summary", latest: null },
      { jobKey: "crypto_news_ingestion", latest: null },
      { jobKey: "crypto_daily_report", latest: null }
    ],
    recentRuns: [],
    jobFailures: [
      { jobKey: "stocks_daily_report", failures: [] },
      {
        jobKey: "market_indices_summary",
        failures: [
          {
            attemptId: "b",
            jobKey: "market_indices_summary",
            triggerType: "cron",
            triggerLabel: "15 20 * * 1-5",
            scheduledFor: "2026-03-13T20:15:00.000Z",
            startedAt: "2026-03-13T20:15:05.000Z",
            finishedAt: "2026-03-13T20:15:08.000Z",
            durationMs: 3000,
            status: "failed",
            message: "summary generation failed",
            errorMessage: "AI provider timeout",
            metadata: null
          }
        ]
      },
      { jobKey: "crypto_news_ingestion", failures: [] },
      { jobKey: "crypto_daily_report", failures: [] }
    ]
  };
}

function createMarketSummary(): MarketAiSummary {
  return {
    summaryDate: "2026-03-13",
    scope: "global_indices",
    summaryZh: "摘要",
    summaryEn: "Summary",
    model: "gpt-5.2",
    snapshotCount: 8,
    createdAt: "2026-03-13T10:00:00.000Z"
  };
}

function createCryptoReport(): DailyReport {
  return {
    reportDate: "2026-03-13",
    generatedAt: "2026-03-13T09:30:00.000Z",
    summaryZh: "日报",
    summaryEn: "Daily report",
    totalQuoteVolumeUsdt: 100,
    upCount: 4,
    downCount: 4,
    flatCount: 2,
    leaderCode: "BTC",
    leaderChange24hPct: 3,
    laggardCode: "ETH",
    laggardChange24hPct: -2,
    items: []
  };
}

function createMacroSnapshot(): CryptoMacroSnapshot {
  return {
    asOf: "2026-03-13T09:20:00.000Z",
    refreshedAt: "2026-03-13T09:25:00.000Z",
    regime: {
      code: "risk_on",
      labelZh: "风险偏好",
      labelEn: "Risk on",
      summaryZh: "摘要",
      summaryEn: "Summary"
    },
    fearGreed: {
      key: "fear_and_greed",
      assetCode: null,
      value: 70,
      previousValue: 66,
      change: 4,
      unit: "index",
      classification: null,
      sourceName: null,
      sourceUrl: null,
      asOf: "2026-03-13T09:20:00.000Z",
      fetchedAt: "2026-03-13T09:25:00.000Z",
      status: "available"
    },
    btcDominance: {
      key: "btc_dominance",
      assetCode: null,
      value: 55,
      previousValue: 54,
      change: 1,
      unit: "percent",
      classification: null,
      sourceName: null,
      sourceUrl: null,
      asOf: "2026-03-13T09:20:00.000Z",
      fetchedAt: "2026-03-13T09:25:00.000Z",
      status: "available"
    }
  };
}

test("buildPlatformStatusPageData merges scheduler and freshness signals", () => {
  const stockReports: ReportListItem[] = [{ reportDateEt: "2026-03-12", createdAt: "2026-03-13T00:10:00.000Z" }];
  const cryptoMarketNews: MarketNewsItem[] = [
    {
      id: 1,
      title: "Latest market news",
      url: "https://example.com",
      source: "MarketBeat",
      publishedAt: "2026-03-13T08:00:00.000Z",
      summaryZh: "摘要",
      summaryEn: "Summary",
      topics: [],
      eventType: "macro",
      stance: "neutral",
      signalScore: 0.2,
      clusterId: null
    }
  ];

  const result = buildPlatformStatusPageData({
    scheduler: createSchedulerStatus(),
    stockReports,
    marketSummary: createMarketSummary(),
    cryptoLatestReport: createCryptoReport(),
    cryptoMacro: createMacroSnapshot(),
    cryptoMarketNews,
    now: () => new Date("2026-03-13T10:30:00.000Z")
  });

  assert.equal(result.scheduler.jobs[0].latest?.status, "success");
  assert.equal(result.scheduler.jobFailures[1]?.failures[0]?.errorMessage, "AI provider timeout");
  assert.equal(result.freshness.length, 5);
  assert.equal(result.freshness[0].key, "stocks_report");
  assert.equal(result.freshness[0].state, "fresh");
  assert.equal(result.freshness[1].key, "market_indices_summary");
  assert.equal(result.freshness[2].primary, "2026-03-13");
  assert.equal(result.freshness[3].primary, "Risk on");
  assert.equal(result.freshness[4].secondary, "Latest market news");
});

test("buildPlatformStatusPageData falls back to missing states cleanly", () => {
  const result = buildPlatformStatusPageData({
    scheduler: null,
    stockReports: [],
    marketSummary: null,
    cryptoLatestReport: null,
    cryptoMacro: null,
    cryptoMarketNews: [],
    now: () => new Date("2026-03-13T10:30:00.000Z")
  });

  assert.equal(result.scheduler.jobs.length, 4);
  assert.equal(result.scheduler.retentionDays, 14);
  assert.equal(result.scheduler.jobFailures.length, 4);
  assert.ok(result.freshness.every((item) => item.state === "missing"));
});

test("normalizeSchedulerStatusResponse backfills new fields for older API payloads", () => {
  const result = normalizeSchedulerStatusResponse(
    {
      generatedAt: "2026-03-13T10:30:00.000Z",
      jobs: [
        { jobKey: "stocks_daily_report", latest: null },
        { jobKey: "market_indices_summary", latest: null }
      ],
      recentRuns: []
    } as Partial<SchedulerStatusResponse>,
    "2026-03-13T11:00:00.000Z"
  );

  assert.equal(result.retentionDays, 14);
  assert.equal(result.jobs.length, 4);
  assert.equal(result.jobFailures.length, 4);
  assert.deepEqual(
    result.jobFailures.map((item) => item.jobKey),
    ["stocks_daily_report", "market_indices_summary", "crypto_news_ingestion", "crypto_daily_report"]
  );
});
