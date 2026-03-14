import assert from "node:assert/strict";
import test from "node:test";

import worker from "../apps/api/src/index.ts";
import { trackSchedulerRun, type SchedulerStatusBucket } from "../apps/api/src/scheduler-status.ts";

class FakeR2Bucket implements SchedulerStatusBucket {
  private readonly storage = new Map<string, string>();

  async put(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.storage.delete(key);
    }
  }

  async get(key: string): Promise<{ json(): Promise<unknown> } | null> {
    const value = this.storage.get(key);
    if (!value) {
      return null;
    }

    return {
      async json(): Promise<unknown> {
        return JSON.parse(value);
      }
    };
  }

  async list(options?: { cursor?: string; prefix?: string; limit?: number }): Promise<{
    cursor?: string;
    objects: Array<{ key: string }>;
    truncated: boolean;
  }> {
    const prefix = options?.prefix ?? "";
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const objects = [...this.storage.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort()
      .slice(0, limit)
      .map((key) => ({ key }));
    return { objects, truncated: false };
  }
}

type TestEnv = {
  STOCKS_ADMIN_TOKEN: string;
  CRYPTO_ADMIN_TOKEN: string;
  SCHEDULER_STATUS_BUCKET: SchedulerStatusBucket;
  STOCKS_OPENAI_BASE_URL?: string;
  STOCKS_AI_MODEL?: string;
  STOCKS_NEWS_BODY_FETCH_ENABLED?: string;
};

const originalFetch = globalThis.fetch;

function createYahooChartPayload() {
  const startTimestamp = Math.floor(new Date("2026-03-10T00:00:00Z").getTime() / 1000);
  return {
    chart: {
      result: [
        {
          meta: {
            currency: "USD"
          },
          timestamp: [startTimestamp, startTimestamp + 24 * 60 * 60],
          indicators: {
            quote: [
              {
                close: [100, 105]
              }
            ]
          }
        }
      ]
    }
  };
}

function createBinanceTickerPayload() {
  const pairs = [
    "BTCUSDT",
    "ETHUSDT",
    "USDCUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "FDUSDUSDT",
    "DOGEUSDT",
    "BNBUSDT",
    "SUIUSDT",
    "TRUMPUSDT"
  ];

  return pairs.map((symbol, index) => ({
    symbol,
    lastPrice: String(100 + index),
    priceChangePercent: String(index - 3),
    highPrice: String(110 + index),
    lowPrice: String(90 + index),
    quoteVolume: String(1000000 + index * 1000),
    closeTime: new Date("2026-03-13T10:00:00.000Z").getTime()
  }));
}

function createEnv(bucket = new FakeR2Bucket(), overrides: Partial<TestEnv> = {}): TestEnv {
  return {
    STOCKS_ADMIN_TOKEN: "stocks-secret",
    CRYPTO_ADMIN_TOKEN: "crypto-secret",
    SCHEDULER_STATUS_BUCKET: bucket,
    ...overrides
  };
}

function createGoogleNewsRss(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>${title}</title><link>https://example.com/story</link><pubDate>Fri, 13 Mar 2026 10:00:00 GMT</pubDate><source url="https://example.com">Example News</source></item></channel></rss>`;
}

function createValidMorningBrief(): string {
  return "隔夜主要指数延续分化，纳指和标普维持偏强节奏，恒生科技与中概资产跟随修复但弹性仍不完全同步。固定观察池里，阿里、拼多多和腾讯一侧承接相对更稳，英伟达、微软与苹果继续决定美股科技情绪中枢，涨跌节奏更多体现为龙头集中而非普遍扩散。消息面仍围绕财报更新、AI投入、监管进展与资本开支展开，相关新闻对重点个股的影响强弱不一，因此当天市场更像是核心资产带动下的结构性活跃，而不是全面扩散的新一轮风险偏好冲刺。";
}

function installStocksRunFetchMock(aiContent: string) {
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("query1.finance.yahoo.com/v8/finance/chart/")) {
      return Response.json(createYahooChartPayload());
    }

    if (url.includes("news.google.com/rss/search")) {
      return new Response(createGoogleNewsRss("Alibaba earnings update keeps AI and cloud focus in view"), {
        status: 200,
        headers: { "content-type": "application/rss+xml; charset=utf-8" }
      });
    }

    if (url.includes("/v1/chat/completions") || url.includes("/chat/completions")) {
      if (init?.method === "POST") {
        return Response.json({
          choices: [
            {
              message: {
                content: aiContent
              }
            }
          ]
        });
      }
    }

    return new Response("not found", { status: 404 });
  };
}

async function request(path: string, init: RequestInit = {}, env = createEnv()): Promise<Response> {
  const requestInit: RequestInit = {
    method: init.method ?? "GET",
    headers: init.headers,
    body: init.body
  };
  return worker.fetch(new Request(`https://example.com${path}`, requestInit), env);
}

test("root routes and scheduler status route return stable shell responses", async () => {
  const bucket = new FakeR2Bucket();
  const env = createEnv(bucket);
  await trackSchedulerRun(
    bucket,
    {
      jobKey: "stocks_daily_report",
      triggerType: "manual",
      triggerLabel: "stocks:/run"
    },
    async () => ({ ok: true })
  );

  const apiIndex = await request("/api/v1", {}, env);
  assert.equal(apiIndex.status, 200);
  const apiIndexBody = (await apiIndex.json()) as { routes: Record<string, string> };
  assert.equal(apiIndexBody.routes.status, "/api/v1/status/scheduler");

  const health = await request("/api/v1/health", {}, env);
  assert.equal(health.status, 200);

  const assets = await request("/api/v1/assets", {}, env);
  assert.equal(assets.status, 200);

  const status = await request("/api/v1/status/scheduler?limit=5", {}, env);
  assert.equal(status.status, 200);
  const statusBody = (await status.json()) as {
    jobFailures: Array<{ failures: unknown[]; jobKey: string }>;
    jobs: Array<{ jobKey: string }>;
    recentRuns: unknown[];
    retentionDays: number;
  };
  assert.equal(statusBody.jobs.length, 4);
  assert.equal(statusBody.retentionDays, 14);
  assert.equal(statusBody.recentRuns.length, 1);
  assert.equal(statusBody.jobFailures.length, 4);

  const notFound = await request("/api/v1/unknown", {}, env);
  assert.equal(notFound.status, 404);
});

test("route coverage matrix exercises stocks and crypto endpoints", async (t) => {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("binance.com/api/v3/ticker/24hr")) {
      return Response.json(createBinanceTickerPayload());
    }

    return Response.json(createYahooChartPayload());
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const env = createEnv();
  const cases: Array<{ method?: string; path: string; status: number }> = [
    { path: "/api/v1/stocks/health", status: 200 },
    { path: "/api/v1/stocks/indices/latest", status: 200 },
    { path: "/api/v1/stocks/indices/history?range=1m", status: 200 },
    { path: "/api/v1/stocks/indices/history?range=bad", status: 400 },
    { path: "/api/v1/stocks/indices/summary/latest", status: 200 },
    { path: "/api/v1/stocks/indices/summary/2026-03-12", status: 200 },
    { path: "/api/v1/stocks/indices/summary/bad-date", status: 400 },
    { path: "/api/v1/stocks/indices/admin/run", status: 401 },
    { path: "/api/v1/stocks/run", status: 401 },
    { path: "/api/v1/stocks/reports?limit=0", status: 400 },
    { path: "/api/v1/stocks/stocks", status: 400 },
    { path: "/api/v1/stocks/stocks/details?symbols=BABA,TCEHY", status: 200 },
    { path: "/api/v1/stocks/stock/BABA", status: 200 },
    { method: "POST", path: "/api/v1/stocks/stocks/preview", status: 400 },
    { method: "POST", path: "/api/v1/stocks/stocks", status: 400 },
    { method: "PUT", path: "/api/v1/stocks/stocks/1", status: 400 },
    { method: "DELETE", path: "/api/v1/stocks/stocks/1", status: 400 },
    { method: "POST", path: "/api/v1/stocks/stocks/1/aliases/regenerate", status: 400 },
    { path: "/api/v1/stocks/report-data/bad-date", status: 400 },
    { path: "/api/v1/stocks/openapi.json", status: 200 },
    { path: "/api/v1/stocks/", status: 200 },
    { path: "/api/v1/stocks/docs", status: 200 },
    { path: "/api/v1/crypto/health", status: 200 },
    { path: "/api/v1/crypto/coins", status: 200 },
    { path: "/api/v1/crypto/latest", status: 200 },
    { path: "/api/v1/crypto/home-snapshot", status: 500 },
    { path: "/api/v1/crypto/report/bad-date", status: 400 },
    { path: "/api/v1/crypto/reports?limit=5", status: 200 },
    { path: "/api/v1/crypto/coin/BTC", status: 200 },
    { path: "/api/v1/crypto/macro/latest", status: 200 },
    { path: "/api/v1/crypto/macro/report/bad-date", status: 400 },
    { path: "/api/v1/crypto/macro/admin/overview", status: 401 },
    { path: "/api/v1/crypto/macro/admin/refresh", status: 401 },
    { path: "/api/v1/crypto/news/market/latest", status: 200 },
    { path: "/api/v1/crypto/news/coin/BTC", status: 200 },
    { path: "/api/v1/crypto/news/clusters", status: 200 },
    { path: "/api/v1/crypto/news/event/0", status: 400 },
    { path: "/api/v1/crypto/news/report/bad-date", status: 400 },
    { path: "/api/v1/crypto/news/report/2026-03-12", status: 200 },
    { path: "/api/v1/crypto/intelligence/aliases", status: 200 },
    { path: "/api/v1/crypto/intelligence/latest", status: 500 },
    { path: "/api/v1/crypto/intelligence/report/bad-date", status: 400 },
    { path: "/api/v1/crypto/intelligence/report/2026-03-12", status: 500 },
    { path: "/api/v1/crypto/news/admin/run", status: 401 },
    { path: "/api/v1/crypto/news/admin/overview", status: 401 },
    { path: "/api/v1/crypto/news/admin/raw", status: 401 },
    { path: "/api/v1/crypto/news/admin/items", status: 401 },
    { path: "/api/v1/crypto/news/admin/clusters", status: 401 },
    { path: "/api/v1/crypto/news/admin/cluster/1", status: 401 },
    { path: "/api/v1/crypto/news/admin/cluster/1/promote/1", status: 401 },
    { path: "/api/v1/crypto/news/admin/reprocess", status: 401 },
    { path: "/api/v1/crypto/run", status: 401 },
    { path: "/api/v1/crypto/", status: 200 }
  ];

  for (const item of cases) {
    const response = await request(
      item.path,
      {
        method: item.method,
        headers: item.method && item.method !== "GET" ? { "content-type": "application/json" } : undefined
      },
      env
    );
    assert.equal(response.status, item.status, `${item.method ?? "GET"} ${item.path}`);
  }
});

test("crypto auxiliary endpoints return stable payload shapes for aliases and report snapshots", async () => {
  const env = createEnv();

  const aliasesResponse = await request("/api/v1/crypto/intelligence/aliases", {}, env);
  assert.equal(aliasesResponse.status, 200);
  const aliasesBody = (await aliasesResponse.json()) as {
    items: Array<{
      keyword: string;
      assetClass: string;
      targetType: string;
      targetId: string;
      labelZh: string;
      labelEn: string;
    }>;
  };
  assert.ok(Array.isArray(aliasesBody.items));
  assert.ok(aliasesBody.items.length > 0);
  assert.equal(typeof aliasesBody.items[0]?.keyword, "string");
  assert.equal(typeof aliasesBody.items[0]?.targetId, "string");
  assert.equal(typeof aliasesBody.items[0]?.labelZh, "string");
  assert.equal(typeof aliasesBody.items[0]?.labelEn, "string");

  const reportSnapshotResponse = await request("/api/v1/crypto/news/report/2026-03-12", {}, env);
  assert.equal(reportSnapshotResponse.status, 200);
  const reportSnapshotBody = (await reportSnapshotResponse.json()) as {
    reportDate: string;
    marketNews: unknown[];
    clusters: unknown[];
    coinNewsByCode: Record<string, unknown>;
  };
  assert.equal(reportSnapshotBody.reportDate, "2026-03-12");
  assert.ok(Array.isArray(reportSnapshotBody.marketNews));
  assert.ok(Array.isArray(reportSnapshotBody.clusters));
  assert.deepEqual(reportSnapshotBody.coinNewsByCode, {});
});

test("stocks run returns the new morning brief field when AI output is valid", async (t) => {
  installStocksRunFetchMock(createValidMorningBrief());
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const env = createEnv(new FakeR2Bucket(), {
    STOCKS_OPENAI_BASE_URL: "https://ai.example.test/v1",
    STOCKS_AI_MODEL: "gpt-5.2",
    STOCKS_NEWS_BODY_FETCH_ENABLED: "false"
  });

  const response = await request(
    "/api/v1/stocks/run",
    {
      headers: { "x-admin-token": env.STOCKS_ADMIN_TOKEN }
    },
    env
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    overview: {
      brief: {
        zh: string | null;
        en: string | null;
      };
    };
  };
  assert.ok(body.overview.brief.zh);
  assert.ok(body.overview.brief.zh?.includes("纳指和标普"));
  assert.equal(typeof body.overview.brief.en, "string");
  assert.ok(!("stock" in body.overview));
  assert.ok(!("news" in body.overview));
});

test("stocks run falls back when the AI morning brief violates guardrails", async (t) => {
  installStocksRunFetchMock("建议买入科技龙头，预计指数将会继续上涨，相关个股值得关注。");
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const env = createEnv(new FakeR2Bucket(), {
    STOCKS_OPENAI_BASE_URL: "https://ai.example.test/v1",
    STOCKS_AI_MODEL: "gpt-5.2",
    STOCKS_NEWS_BODY_FETCH_ENABLED: "false"
  });

  const response = await request(
    "/api/v1/stocks/run",
    {
      headers: { "x-admin-token": env.STOCKS_ADMIN_TOKEN }
    },
    env
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    overview: {
      brief: {
        zh: string | null;
      };
    };
  };
  assert.ok(body.overview.brief.zh);
  assert.ok(!body.overview.brief.zh?.includes("建议买入"));
  assert.ok(!body.overview.brief.zh?.includes("预计"));
  assert.ok(body.overview.brief.zh?.includes("主要指数") || body.overview.brief.zh?.includes("消息面"));
});
