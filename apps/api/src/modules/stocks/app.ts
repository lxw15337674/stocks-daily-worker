import { swaggerUI } from "@hono/swagger-ui";
import { launch, type BrowserContext, type BrowserWorker } from "@cloudflare/playwright";
import { Readability } from "@mozilla/readability";
import { and, asc, desc, eq, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";
import { parseHTML } from "linkedom";
import type {
  LocalizedText,
  MarketAiSummaryResponse,
  MarketIndexHistoryResponse,
  MarketIndexLatestResponse,
  MarketIndexRange,
  MarketIndicesAdminRunResponse,
  ReportListItem,
  StockDailyReport,
  StockDetailListResponse,
  StockDetailResult,
  StockListItem,
  StockNewsItem,
  StockReportNewsGroup,
  StockReportOverview,
  StockReportQuoteItem,
  StockQuoteSnapshot
} from "@china-stocks/contracts";
import {
  getMarketAiSummaryByDate,
  getLatestMarketAiSummary,
  getLiveMarketIndicesHistory,
  getLiveMarketIndicesLatest,
  runMarketIndicesAdminSync,
  runMarketIndicesScheduledSync
} from "./indices.ts";
import { trackSchedulerRun, type SchedulerStatusBucket } from "../../scheduler-status.ts";
import { reportNews, reportQuotes, reportRuns, stocks as stocksTable } from "./schema.ts";

interface Env {
  DB?: D1Database;
  BROWSER?: BrowserWorker;
  ADMIN_TOKEN?: string;
  WEBHOOK_URL?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  AI_MODEL?: string;
  NEWS_BODY_FETCH_ENABLED?: string;
  NEWS_BODY_PER_STOCK_LIMIT?: string;
  NEWS_BODY_TIMEOUT_MS?: string;
  NEWS_BODY_MAX_CHARS?: string;
  // Backward-compatible aliases.
  AI_GATEWAY_BASE_URL?: string;
  AI_API_KEY?: string;
  STATUS_BUCKET?: SchedulerStatusBucket;
}

type Stock = {
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  aliases: string[];
};

type Quote = {
  symbol: string;
  name: string;
  close: number;
  previousClose: number;
  changePct: number;
  volume: number;
  turnoverEstimate: number;
  currency: string;
};

type NewsItem = {
  symbol: string;
  title: string;
  link: string;
  source: string;
  publishedAt: Date;
  bodySnippet?: string;
};

type MorningBriefContextStock = {
  symbol: string;
  displayName: string;
  changePct: number | null;
  newsCount: number;
};

type MorningBriefNewsItem = {
  symbol: string;
  title: string;
  source: string;
  publishedAt: Date;
  bodySnippet?: string;
};

type ReportSummary = {
  stockSummaryBySymbol: Map<string, LocalizedText>;
  morningBriefZh: string;
  morningBriefEn: string;
};

type NewsBodyDebugSymbolSummary = {
  symbol: string;
  totalItems: number;
  snippetItems: number;
  sampleSnippet: string | null;
  sampleLink: string | null;
};

type NewsBodyDebugSummary = {
  enabled: boolean;
  perStockLimit: number;
  browserBindingConfigured: boolean;
  browserContextReady: boolean;
  totalItems: number;
  snippetItems: number;
  symbols: NewsBodyDebugSymbolSummary[];
};

type StockAdminItem = StockListItem;

type StockMutationInput = {
  symbol?: string;
  name?: string;
  displayName?: string;
  codes?: string;
  businessType?: string;
  aliases?: string[];
  sortOrder?: number;
  isActive?: boolean;
};

type StockPreviewInput = {
  name: string;
};

type StockPreviewCandidate = {
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  aliases: string[];
  warnings: string[];
  rationale?: string;
};

type StockHistoryPoint = StockQuoteSnapshot & {
  reportDateEt: string;
};

type StockNewsSummaryItem = StockNewsItem;

type StockDetailPayload = StockDetailResult;

type StockDetailBatchPayload = StockDetailListResponse;

type StockRecord = typeof stocksTable.$inferSelect;

// Default stock list (mixed US/HK tradable symbols).
const DEFAULT_STOCKS: Stock[] = [
  {
    symbol: "KWEB",
    name: "KraneShares CSI China Internet ETF",
    displayName: "中国互联网ETF (KWEB)",
    codes: "KWEB",
    businessType: "中国互联网指数ETF",
    aliases: ["KWEB", "KraneShares", "中国互联网ETF"]
  },
  {
    symbol: "CWEB",
    name: "Direxion Daily CSI China Internet Index Bull 2X Shares",
    displayName: "中国互联网2倍杠杆ETF (CWEB)",
    codes: "CWEB",
    businessType: "中国互联网指数2倍杠杆ETF",
    aliases: ["CWEB", "Direxion", "中国互联网2倍杠杆ETF"]
  },
  {
    symbol: "0700.HK",
    name: "Tencent Holdings",
    displayName: "腾讯控股 (Tencent)",
    codes: "HK:0700",
    businessType: "社交、游戏、支付",
    aliases: ["腾讯", "腾讯控股", "Tencent", "HK:0700", "0700.HK"]
  },
  {
    symbol: "BABA",
    name: "Alibaba",
    displayName: "阿里巴巴 (Alibaba)",
    codes: "BABA / HK:9988",
    businessType: "电商、云服务",
    aliases: ["阿里", "阿里巴巴", "Alibaba", "BABA", "HK:9988", "9988.HK"]
  },
  {
    symbol: "PDD",
    name: "PDD Holdings",
    displayName: "拼多多 (PDD Holdings)",
    codes: "PDD",
    businessType: "跨境电商、国内电商",
    aliases: ["拼多多", "PDD", "PDD Holdings"]
  },
  {
    symbol: "3690.HK",
    name: "Meituan",
    displayName: "美团 (Meituan)",
    codes: "HK:3690",
    businessType: "本地生活、外卖",
    aliases: ["美团", "Meituan", "HK:3690", "3690.HK"]
  },
  {
    symbol: "NTES",
    name: "NetEase",
    displayName: "网易 (NetEase)",
    codes: "NTES / HK:9999",
    businessType: "游戏、在线教育",
    aliases: ["网易", "NetEase", "NTES", "HK:9999", "9999.HK"]
  },
  {
    symbol: "BIDU",
    name: "Baidu",
    displayName: "百度 (Baidu)",
    codes: "BIDU / HK:9888",
    businessType: "AI、搜索、自动驾驶",
    aliases: ["百度", "Baidu", "BIDU", "HK:9888", "9888.HK"]
  },
  {
    symbol: "TCOM",
    name: "Trip.com",
    displayName: "携程 (Trip.com)",
    codes: "TCOM / HK:9961",
    businessType: "在线旅游",
    aliases: ["携程", "Trip.com", "TCOM", "HK:9961", "9961.HK"]
  },
  {
    symbol: "JD",
    name: "JD.com",
    displayName: "京东 (JD.com)",
    codes: "JD / HK:9618",
    businessType: "电商、物流",
    aliases: ["京东", "JD", "JD.com", "HK:9618", "9618.HK"]
  },
  {
    symbol: "TME",
    name: "Tencent Music",
    displayName: "腾讯音乐 (Tencent Music)",
    codes: "TME / HK:1698",
    businessType: "在线音乐",
    aliases: ["腾讯音乐", "Tencent Music", "TME", "HK:1698", "1698.HK"]
  },
  {
    symbol: "1024.HK",
    name: "Kuaishou",
    displayName: "快手 (Kuaishou)",
    codes: "HK:1024",
    businessType: "短视频、直播",
    aliases: ["快手", "Kuaishou", "HK:1024", "1024.HK"]
  },
  {
    symbol: "AAPL",
    name: "Apple",
    displayName: "苹果 (Apple)",
    codes: "AAPL",
    businessType: "消费电子、软件服务",
    aliases: ["苹果", "Apple", "AAPL"]
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    displayName: "微软 (Microsoft)",
    codes: "MSFT",
    businessType: "云计算、企业软件、AI",
    aliases: ["微软", "Microsoft", "MSFT"]
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    displayName: "英伟达 (NVIDIA)",
    codes: "NVDA",
    businessType: "AI芯片、GPU、数据中心",
    aliases: ["英伟达", "NVIDIA", "NVDA"]
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    displayName: "亚马逊 (Amazon)",
    codes: "AMZN",
    businessType: "电商、云计算、广告",
    aliases: ["亚马逊", "Amazon", "AMZN"]
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    displayName: "谷歌 (Alphabet)",
    codes: "GOOGL / GOOG",
    businessType: "搜索、广告、云计算、AI",
    aliases: ["谷歌", "Alphabet", "Google", "GOOGL", "GOOG"]
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    displayName: "Meta (Meta Platforms)",
    codes: "META",
    businessType: "社交广告、AI、VR",
    aliases: ["Meta", "Facebook", "META", "Meta Platforms"]
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    displayName: "特斯拉 (Tesla)",
    codes: "TSLA",
    businessType: "智能电动车、储能、自动驾驶",
    aliases: ["特斯拉", "Tesla", "TSLA"]
  },
  {
    symbol: "AVGO",
    name: "Broadcom",
    displayName: "博通 (Broadcom)",
    codes: "AVGO",
    businessType: "半导体、基础设施软件",
    aliases: ["博通", "Broadcom", "AVGO"]
  },
  {
    symbol: "ORCL",
    name: "Oracle",
    displayName: "甲骨文 (Oracle)",
    codes: "ORCL",
    businessType: "数据库、云基础设施、企业软件",
    aliases: ["甲骨文", "Oracle", "ORCL"]
  },
  {
    symbol: "NFLX",
    name: "Netflix",
    displayName: "奈飞 (Netflix)",
    codes: "NFLX",
    businessType: "流媒体、内容平台",
    aliases: ["奈飞", "Netflix", "NFLX"]
  }
];

const ET_TIMEZONE = "America/New_York";
const CN_TIMEZONE = "Asia/Shanghai";
const OPENAPI_VERSION = "3.1.0";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const NEWS_BODY_FETCH_ENABLED_DEFAULT = true;
const NEWS_BODY_PER_STOCK_LIMIT_DEFAULT = 2;
const NEWS_BODY_TIMEOUT_MS_DEFAULT = 4500;
const NEWS_BODY_MAX_CHARS_DEFAULT = 900;
const MARKET_INDICES_SUMMARY_CRON_DST = "15 20 * * 1-5";
const MARKET_INDICES_SUMMARY_CRON_STD = "15 21 * * 1-5";
const MORNING_BRIEF_MIN_ZH_CHARS = 180;
const MORNING_BRIEF_MAX_ZH_CHARS = 300;
const MORNING_BRIEF_MIN_EN_WORDS = 120;
const MORNING_BRIEF_MAX_EN_WORDS = 180;
const MORNING_BRIEF_BANNED_ZH = ["买入", "卖出", "抄底", "逃顶", "看好", "看空", "有望", "预计", "将会", "必然", "建议"];
const MORNING_BRIEF_BANNED_EN = ["buy", "sell", "overweight", "underweight", "target price", "will", "expected to"];
const CHINA_CONCEPT_SYMBOLS = new Set([
  "KWEB",
  "CWEB",
  "0700.HK",
  "BABA",
  "PDD",
  "3690.HK",
  "NTES",
  "BIDU",
  "TCOM",
  "JD",
  "TME",
  "1024.HK"
]);
const US_TECH_TOP10_SYMBOLS = new Set(["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "ORCL", "NFLX"]);

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const startedAt = Date.now();
  const requestUrl = new URL(c.req.url);
  const requestTarget = `${requestUrl.pathname}${requestUrl.search}`;

  await next();

  const durationMs = Date.now() - startedAt;
  c.res.headers.set("x-response-time", `${durationMs}ms`);
  console.log(`[HTTP] ${c.req.method} ${requestTarget} -> ${c.res.status} (${durationMs}ms)`);
});

app.get(
  "/health",
  describeRoute({
    tags: ["Meta"],
    summary: "Health check",
    responses: {
      "200": {
        description: "Service health status",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                ok: { type: "boolean" },
                service: { type: "string" }
              },
              required: ["ok", "service"]
            }
          }
        }
      }
    }
  }),
  (c) => c.json({ ok: true, service: "china-stocks-daily-worker" })
);

app.get(
  "/indices/latest",
  describeRoute({
    tags: ["Market Indices"],
    summary: "Get live market index snapshot",
    description: "Fetches the latest available CN, HK, and US index data from the upstream market source.",
    responses: {
      "200": {
        description: "Grouped market pulse response",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      }
    }
  }),
  async (c) => {
    const payload = await getLiveMarketIndicesLatest();
    return c.json<MarketIndexLatestResponse>(payload);
  }
);

app.get(
  "/indices/history",
  describeRoute({
    tags: ["Market Indices"],
    summary: "Get live market index history",
    description: "Fetches historical daily index bars for the requested tracked indices.",
    parameters: [
      {
        name: "indexKeys",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Comma-separated tracked index keys. Defaults to the full tracked universe."
      },
      {
        name: "range",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["1m", "3m", "1y"], default: "1m" },
        description: "History range."
      }
    ],
    responses: {
      "200": {
        description: "Historical market index series",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      },
      "400": {
        description: "Invalid query parameters"
      }
    }
  }),
  async (c) => {
    const range = parseMarketIndexRange(c.req.query("range"));
    if (!range) {
      return c.text("Invalid range. Use 1m, 3m, or 1y.", 400);
    }

    const indexKeys = (c.req.query("indexKeys") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const payload = await getLiveMarketIndicesHistory(indexKeys, range);
    return c.json<MarketIndexHistoryResponse>(payload);
  }
);

app.get(
  "/indices/summary/latest",
  describeRoute({
    tags: ["Market Indices"],
    summary: "Get latest archived global market AI summary",
    responses: {
      "200": {
        description: "Latest AI summary payload",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      }
    }
  }),
  async (c) => {
    const payload = await getLatestMarketAiSummary(c.env);
    return c.json<MarketAiSummaryResponse>(payload);
  }
);

app.get(
  "/indices/summary/:date",
  describeRoute({
    tags: ["Market Indices"],
    summary: "Get archived global market AI summary by date",
    parameters: [
      {
        name: "date",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        description: "Summary date in YYYY-MM-DD format."
      }
    ],
    responses: {
      "200": {
        description: "Archived AI summary payload",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      },
      "400": {
        description: "Invalid date parameter"
      }
    }
  }),
  async (c) => {
    const summaryDate = parseSummaryDate(c.req.param("date"));
    if (!summaryDate) {
      return c.text("Invalid date. Use YYYY-MM-DD.", 400);
    }

    const payload = await getMarketAiSummaryByDate(c.env, summaryDate);
    return c.json<MarketAiSummaryResponse>(payload);
  }
);

app.get(
  "/indices/admin/run",
  describeRoute({
    tags: ["Market Indices"],
    summary: "Sync and summarize tracked market indices",
    parameters: [
      {
        name: "x-admin-token",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Admin token"
      }
    ],
    responses: {
      "200": {
        description: "Manual sync result",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      },
      "401": {
        description: "Missing or invalid admin token"
      }
    }
  }),
  async (c) => {
    const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
    if (authError) {
      return new Response(authError.message, { status: authError.status });
    }

    const payload = await trackSchedulerRun(
      c.env.STATUS_BUCKET,
      {
        jobKey: "market_indices_summary",
        triggerType: "manual",
        triggerLabel: "stocks:/indices/admin/run",
        onSuccess: (result) => ({
          message: "Market indices sync completed.",
          metadata: {
            summaryDate: result.summaryDate,
            snapshotCount: result.snapshotCount
          }
        })
      },
      () => runMarketIndicesAdminSync(c.env)
    );
    return c.json<MarketIndicesAdminRunResponse>(payload);
  }
);

app.get(
  "/run",
  describeRoute({
    tags: ["Reports"],
    summary: "Generate report now",
    description: "Generate the daily report immediately and return structured report data.",
    parameters: [
      {
        name: "x-admin-token",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Admin token"
      }
    ],
    responses: {
      "200": {
        description: "Generated structured report",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                reportDateEt: { type: "string" },
                createdAt: { type: "string" },
                sampleSize: { type: "integer" },
                validQuoteCount: { type: "integer" }
              },
              required: ["reportDateEt", "createdAt", "sampleSize", "validQuoteCount"]
            }
          }
        }
      },
      "401": {
        description: "Missing or invalid admin token"
      },
      "500": {
        description: "ADMIN_TOKEN is not configured on server"
      }
    }
  }),
  async (c) => {
    const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
    if (authError) {
      return new Response(authError.message, { status: authError.status });
    }

    const includeNewsBodyDebugRequested = parseBooleanQuery(c.req.query("debugNewsBody"));
    const includeNewsBodyDebug = includeNewsBodyDebugRequested && isLocalDevDebugRequest(c.req.raw.url);
    if (includeNewsBodyDebugRequested && !includeNewsBodyDebug) {
      return c.text("debugNewsBody is only available in local development.", 403);
    }
    let newsBodyDebug: NewsBodyDebugSummary | null = null;

    const result = await trackSchedulerRun(
      c.env.STATUS_BUCKET,
      {
        jobKey: "stocks_daily_report",
        triggerType: "manual",
        triggerLabel: "stocks:/run",
        onSuccess: (payload) => ({
          message: "Stocks report generated.",
          metadata: {
            reportDateEt: payload.reportDateEt,
            sampleSize: payload.sampleSize,
            validQuoteCount: payload.validQuoteCount
          }
        })
      },
      () =>
        generateAndPersistReport(c.env, {
          captureNewsBodyDebug: includeNewsBodyDebug
            ? (summary) => {
                newsBodyDebug = summary;
              }
            : undefined
        })
    );
    if (!includeNewsBodyDebug) {
      return c.json(result);
    }
    return c.json({
      ...result,
      _debugNewsBody: newsBodyDebug
    });
  }
);

app.get(
  "/reports",
  describeRoute({
    tags: ["Reports"],
    summary: "List archived reports",
    description: "Lists report history from D1.",
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 200, default: 30 },
        description: "Page size"
      },
      {
        name: "cursor",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Pagination cursor returned by a previous response"
      }
    ],
    responses: {
      "200": {
        description: "Paginated report list",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                limit: { type: "integer" },
                nextCursor: { anyOf: [{ type: "string" }, { type: "null" }] },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      reportDateEt: { type: "string" },
                      createdAt: { type: "string" }
                    },
                    required: ["reportDateEt", "createdAt"]
                  }
                }
              },
              required: ["limit", "nextCursor", "items"]
            }
          }
        }
      },
      "400": {
        description: "Invalid request parameters or missing storage binding",
        content: {
          "text/plain": {
            schema: { type: "string" }
          }
        }
      }
    }
  }),
  async (c) => {
    const limit = parseLimit(c.req.query("limit"));
    if (!limit) {
      return c.text("Invalid limit. Use integer between 1 and 200.", 400);
    }

    const beforeId = parseCursor(c.req.query("cursor"));
    if (beforeId === "invalid") {
      return c.text("Invalid cursor. Use a positive integer id.", 400);
    }

    const list = await getReportListFromD1(c.env, limit, beforeId);
    return c.json({
      limit,
      nextCursor: list.nextCursor,
      items: list.items
    });
  }
);

app.get(
  "/stocks",
  describeRoute({
    tags: ["Stocks"],
    summary: "List stock universe",
    description: "Returns active stocks by default. Set includeInactive=true with admin token to include soft-deleted rows.",
    parameters: [
      {
        name: "includeInactive",
        in: "query",
        required: false,
        schema: { type: "boolean", default: false },
        description: "Include inactive rows. Requires admin token."
      }
    ],
    responses: {
      "200": {
        description: "Stock list",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      symbol: { type: "string" },
                      name: { type: "string" },
                      displayName: { type: "string" },
                      codes: { type: "string" },
                      businessType: { type: "string" },
                      aliases: { type: "array", items: { type: "string" } },
                      isActive: { type: "boolean" },
                      sortOrder: { type: "integer" },
                      createdAt: { type: "string" },
                      updatedAt: { type: "string" },
                      deletedAt: { anyOf: [{ type: "string" }, { type: "null" }] }
                    },
                    required: [
                      "id",
                      "symbol",
                      "name",
                      "displayName",
                      "codes",
                      "businessType",
                      "aliases",
                      "isActive",
                      "sortOrder",
                      "createdAt",
                      "updatedAt",
                      "deletedAt"
                    ]
                  }
                }
              },
              required: ["items"]
            }
          }
        }
      },
      "401": {
        description: "Missing or invalid admin token"
      }
    }
  }),
  async (c) => {
    if (!c.env.DB) {
      return c.text("DB binding is required.", 400);
    }
    await ensureD1Schema(c.env.DB);

    const includeInactive = parseBooleanQuery(c.req.query("includeInactive"));
    if (includeInactive && !isAdminRequestAuthorized(c.req.header("x-admin-token"), c.env)) {
      return c.text("Unauthorized.", 401);
    }

    const items = await listStocksFromD1(c.env.DB, { includeInactive });
    return c.json({ items });
  }
);

app.get(
  "/stocks/details",
  describeRoute({
    tags: ["Stocks"],
    summary: "Get public stock details in batch",
    description: "Returns public stock detail payloads for a comma-separated symbol list.",
    responses: {
      "200": {
        description: "Batch stock detail payload",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      },
      "400": {
        description: "Invalid symbols parameter"
      }
    }
  }),
  async (c) => {
    const rawSymbols = c.req.query("symbols") ?? "";
    const symbols = Array.from(
      new Set(
        rawSymbols
          .split(",")
          .map((value) => normalizeSymbol(value))
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    if (symbols.length > 60) {
      return c.text("Too many symbols. Maximum 60 per request.", 400);
    }

    const items = (
      await Promise.all(symbols.map((symbol) => getPublicStockDetail(c.env, symbol)))
    ).filter((item): item is StockDetailPayload => item !== null);

    return c.json<StockDetailBatchPayload>({ items });
  }
);

app.get(
  "/stock/:symbol",
  describeRoute({
    tags: ["Stocks"],
    summary: "Get public stock detail",
    description: "Returns stock profile, latest quote snapshot, AI summary, recent news, and recent quote history.",
    responses: {
      "200": {
        description: "Stock detail payload",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                stock: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    symbol: { type: "string" },
                    name: { type: "string" },
                    displayName: { type: "string" },
                    codes: { type: "string" },
                    businessType: { type: "string" },
                    aliases: { type: "array", items: { type: "string" } },
                    isActive: { type: "boolean" },
                    sortOrder: { type: "integer" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                    deletedAt: { anyOf: [{ type: "string" }, { type: "null" }] }
                  },
                  required: [
                    "id",
                    "symbol",
                    "name",
                    "displayName",
                    "codes",
                    "businessType",
                    "aliases",
                    "isActive",
                    "sortOrder",
                    "createdAt",
                    "updatedAt",
                    "deletedAt"
                  ]
                },
                latestReportDateEt: { anyOf: [{ type: "string" }, { type: "null" }] },
                latestQuote: {
                  anyOf: [
                    {
                      type: "object",
                      properties: {
                        close: { type: "number" },
                        previousClose: { type: "number" },
                        changePct: { type: "number" },
                        volume: { type: "number" },
                        turnoverEstimate: { type: "number" },
                        currency: { type: "string" }
                      },
                      required: ["close", "previousClose", "changePct", "volume", "turnoverEstimate", "currency"]
                    },
                    { type: "null" }
                  ]
                },
                latestAiSummary: {
                  type: "object",
                  properties: {
                    zh: { anyOf: [{ type: "string" }, { type: "null" }] },
                    en: { anyOf: [{ type: "string" }, { type: "null" }] }
                  },
                  required: ["zh", "en"]
                },
                recentNews: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      link: { type: "string" },
                      source: { type: "string" },
                      publishedAt: { type: "string" }
                    },
                    required: ["title", "link", "source", "publishedAt"]
                  }
                },
                history: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      reportDateEt: { type: "string" },
                      close: { type: "number" },
                      previousClose: { type: "number" },
                      changePct: { type: "number" },
                      volume: { type: "number" },
                      turnoverEstimate: { type: "number" },
                      currency: { type: "string" }
                    },
                    required: ["reportDateEt", "close", "previousClose", "changePct", "volume", "turnoverEstimate", "currency"]
                  }
                },
                reportRecords: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      reportDateEt: { type: "string" },
                      close: { type: "number" },
                      changePct: { type: "number" },
                      newsCount: { type: "integer" },
                      aiSummary: {
                        type: "object",
                        properties: {
                          zh: { anyOf: [{ type: "string" }, { type: "null" }] },
                          en: { anyOf: [{ type: "string" }, { type: "null" }] }
                        },
                        required: ["zh", "en"]
                      }
                    },
                    required: ["reportDateEt", "close", "changePct", "newsCount", "aiSummary"]
                  }
                }
              },
              required: ["stock", "latestReportDateEt", "latestQuote", "latestAiSummary", "recentNews", "history", "reportRecords"]
            }
          }
        }
      },
      "404": {
        description: "Stock not found"
      }
    }
  }),
  async (c) => {
    const inputSymbol = normalizeSymbol(c.req.param("symbol"));
    if (!inputSymbol) {
      return c.text("Invalid stock symbol.", 400);
    }

    const detail = await getPublicStockDetail(c.env, inputSymbol);
    if (!detail) {
      return c.text("Stock not found.", 404);
    }

    return c.json(detail);
  }
);

app.post(
  "/stocks/preview",
  describeRoute({
    tags: ["Stocks"],
    summary: "Preview stock info by AI",
    description:
      "Generate multiple AI draft candidates for stock creation (including aliases) without writing to DB.",
    responses: {
      "200": { description: "Preview candidates generated" },
      "400": { description: "Invalid payload" },
      "401": { description: "Missing or invalid admin token" }
    }
  }),
  async (c) => {
    if (!c.env.DB) {
      return c.text("DB binding is required.", 400);
    }
    await ensureD1Schema(c.env.DB);

    const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
    if (authError) {
      return new Response(authError.message, { status: authError.status });
    }

    const payload = await readJsonSafe(c.req.raw);
    const parsed = parseStockPreviewInput(payload);
    if (!parsed.ok) {
      return c.text(parsed.error, 400);
    }

    const preview = await buildStockPreview(c.env, parsed.value);
    return c.json(preview);
  }
);

app.post(
  "/stocks",
  describeRoute({
    tags: ["Stocks"],
    summary: "Create stock",
    description: "Create a stock row and auto-generate aliases with AI. symbol is optional when name is provided.",
    responses: {
      "201": { description: "Created stock row" },
      "400": { description: "Invalid payload" },
      "401": { description: "Missing or invalid admin token" },
      "409": { description: "Stock symbol already exists" }
    }
  }),
  async (c) => {
    if (!c.env.DB) {
      return c.text("DB binding is required.", 400);
    }
    await ensureD1Schema(c.env.DB);

    const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
    if (authError) {
      return new Response(authError.message, { status: authError.status });
    }

    const payload = await readJsonSafe(c.req.raw);
    if (!payload || typeof payload !== "object") {
      return c.text("Invalid JSON payload.", 400);
    }

    const parsed = parseStockMutationInput(payload, { requireSymbol: false });
    if (!parsed.ok) {
      return c.text(parsed.error, 400);
    }

    const result = await createStock(c.env, parsed.value);
    if (!result.ok) {
      return new Response(result.error, { status: result.status });
    }

    return c.json(result.item, 201);
  }
);

app.put(
  "/stocks/:id",
  describeRoute({
    tags: ["Stocks"],
    summary: "Update stock",
    description: "Update stock fields and auto-regenerate aliases with AI.",
    responses: {
      "200": { description: "Updated stock row" },
      "400": { description: "Invalid payload" },
      "401": { description: "Missing or invalid admin token" },
      "409": { description: "Stock symbol already exists" },
      "404": { description: "Stock not found" }
    }
  }),
  async (c) => {
    if (!c.env.DB) {
      return c.text("DB binding is required.", 400);
    }
    await ensureD1Schema(c.env.DB);

    const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
    if (authError) {
      return new Response(authError.message, { status: authError.status });
    }

    const stockId = Number(c.req.param("id"));
    if (!Number.isInteger(stockId) || stockId < 1) {
      return c.text("Invalid stock id.", 400);
    }

    const payload = await readJsonSafe(c.req.raw);
    if (!payload || typeof payload !== "object") {
      return c.text("Invalid JSON payload.", 400);
    }

    const parsed = parseStockMutationInput(payload, { requireSymbol: false });
    if (!parsed.ok) {
      return c.text(parsed.error, 400);
    }

    const result = await updateStock(c.env, stockId, parsed.value);
    if (!result.ok) {
      return new Response(result.error, { status: result.status });
    }

    return c.json(result.item);
  }
);

app.delete(
  "/stocks/:id",
  describeRoute({
    tags: ["Stocks"],
    summary: "Soft-delete stock",
    description: "Marks a stock as inactive.",
    responses: {
      "200": { description: "Soft delete success" },
      "401": { description: "Missing or invalid admin token" },
      "404": { description: "Stock not found" }
    }
  }),
  async (c) => {
    if (!c.env.DB) {
      return c.text("DB binding is required.", 400);
    }
    await ensureD1Schema(c.env.DB);

    const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
    if (authError) {
      return new Response(authError.message, { status: authError.status });
    }

    const stockId = Number(c.req.param("id"));
    if (!Number.isInteger(stockId) || stockId < 1) {
      return c.text("Invalid stock id.", 400);
    }

    const row = await getStockRowById(c.env.DB, stockId);
    if (!row) {
      return c.text("Stock not found.", 404);
    }

    const db = drizzle(c.env.DB);
    await db
      .update(stocksTable)
      .set({ isActive: false, deletedAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(stocksTable.id, stockId));

    const updated = await getStockRowById(c.env.DB, stockId);
    return c.json(updated ? stockRowToItem(updated) : { ok: true });
  }
);

app.post(
  "/stocks/:id/aliases/regenerate",
  describeRoute({
    tags: ["Stocks"],
    summary: "Regenerate aliases by AI",
    description: "Regenerates aliases for a stock with AI and conflict filters.",
    responses: {
      "200": { description: "Updated stock row" },
      "401": { description: "Missing or invalid admin token" },
      "404": { description: "Stock not found" }
    }
  }),
  async (c) => {
    if (!c.env.DB) {
      return c.text("DB binding is required.", 400);
    }
    await ensureD1Schema(c.env.DB);

    const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
    if (authError) {
      return new Response(authError.message, { status: authError.status });
    }

    const stockId = Number(c.req.param("id"));
    if (!Number.isInteger(stockId) || stockId < 1) {
      return c.text("Invalid stock id.", 400);
    }

    const row = await getStockRowById(c.env.DB, stockId);
    if (!row) {
      return c.text("Stock not found.", 404);
    }

    const aliases = await buildAliasesForStock(c.env, stockRowToItem(row), stockId);
    const db = drizzle(c.env.DB);
    await db
      .update(stocksTable)
      .set({ aliasesJson: JSON.stringify(aliases), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(stocksTable.id, stockId));

    const updated = await getStockRowById(c.env.DB, stockId);
    return c.json(updated ? stockRowToItem(updated) : { ok: true });
  }
);

app.get(
  "/report-data/:date",
  describeRoute({
    tags: ["Reports"],
    summary: "Get structured report data by date",
    description: "Returns localized morning brief plus structured quote and news sections from D1.",
    parameters: [
      {
        name: "date",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        description: "Date in YYYY-MM-DD format"
      }
    ],
    responses: {
      "200": {
        description: "Structured report data",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                reportDateEt: { type: "string" },
                createdAt: { type: "string" },
                sampleSize: { type: "integer" },
                validQuoteCount: { type: "integer" },
                overview: {
                  type: "object",
                  properties: {
                    brief: {
                      type: "object",
                      properties: {
                        zh: { anyOf: [{ type: "string" }, { type: "null" }] },
                        en: { anyOf: [{ type: "string" }, { type: "null" }] }
                      },
                      required: ["zh", "en"]
                    }
                  },
                  required: ["brief"]
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string" },
                      name: { type: "string" },
                      displayName: { type: "string" },
                      codes: { type: "string" },
                      businessType: { type: "string" },
                      close: { type: "number" },
                      previousClose: { type: "number" },
                      changePct: { type: "number" },
                      volume: { type: "number" },
                      turnoverEstimate: { type: "number" },
                      currency: { type: "string" }
                    },
                    required: [
                      "symbol",
                      "name",
                      "displayName",
                      "codes",
                      "businessType",
                      "close",
                      "previousClose",
                      "changePct",
                      "volume",
                      "turnoverEstimate",
                      "currency"
                    ]
                  }
                },
                newsGroups: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string" },
                      name: { type: "string" },
                      displayName: { type: "string" },
                      changePct: { anyOf: [{ type: "number" }, { type: "null" }] },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            link: { type: "string" },
                            source: { type: "string" },
                            publishedAt: { type: "string" }
                          },
                          required: ["title", "link", "source", "publishedAt"]
                        }
                      }
                    },
                    required: ["symbol", "name", "displayName", "changePct", "items"]
                  }
                }
              },
              required: ["reportDateEt", "createdAt", "sampleSize", "validQuoteCount", "overview", "items", "newsGroups"]
            }
          }
        }
      },
      "400": {
        description: "Invalid date format"
      },
      "404": {
        description: "Structured report data not found"
      }
    }
  }),
  async (c) => {
    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.text("Invalid date format. Use YYYY-MM-DD.", 400);
    }

    let report = await getStructuredReportByDateFromD1(c.env, date);
    if (!report && date === formatDate(new Date(), ET_TIMEZONE)) {
      const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
      if (!authError) {
        await generateAndPersistReport(c.env);
        report = await getStructuredReportByDateFromD1(c.env, date);
      }
    }

    if (!report) {
      return c.text("Structured report data not found.", 404);
    }

    return c.json(report);
  }
);

app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      openapi: OPENAPI_VERSION,
      info: {
        title: "China Stocks Daily Worker API",
        version: "0.1.0",
        description: "Generate and fetch structured daily reports for the tracked equity universe."
      }
    }
  })
);

app.get(
  "/",
  describeRoute({
    tags: ["Meta"],
    summary: "Interactive API docs",
    description: "Swagger UI page powered by /openapi.json.",
    responses: {
      "200": {
        description: "HTML docs page",
        content: {
          "text/html": {
            schema: { type: "string" }
          }
        }
      }
    }
  }),
  swaggerUI({
    url: "/openapi.json",
    title: "China Stocks Daily Worker API Docs"
  })
);

app.get(
  "/docs",
  swaggerUI({
    url: "/openapi.json",
    title: "China Stocks Daily Worker API Docs"
  })
);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    if (event.cron === MARKET_INDICES_SUMMARY_CRON_DST || event.cron === MARKET_INDICES_SUMMARY_CRON_STD) {
      await runMarketIndicesScheduledSync(env);
      return;
    }

    await generateAndPersistReport(env, { requireDb: true });
  }
};

async function generateAndPersistReport(
  env: Env,
  options?: {
    requireDb?: boolean;
    captureNewsBodyDebug?: (summary: NewsBodyDebugSummary) => void;
  }
): Promise<StockDailyReport> {
  const stocks = await getStockUniverse(env);
  const quotes = (await Promise.all(stocks.map((stock) => fetchQuote(stock)))).filter(
    (item): item is Quote => item !== null
  );

  const newsBodyConfig = getNewsBodyFetchConfig(env);
  let browserContext: BrowserContext | null = null;
  let browserToClose: { close: () => Promise<void> } | null = null;
  if (newsBodyConfig.enabled && newsBodyConfig.perStockLimit > 0) {
    if (env.BROWSER) {
      try {
        const browser = await launch(env.BROWSER);
        browserToClose = browser;
        browserContext = await browser.newContext({
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        });
      } catch (error) {
        console.error(`[stocks][news-body] Failed to launch browser session: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.warn("[stocks][news-body] Browser binding is not configured; skipping body extraction.");
    }
  }

  const newsBySymbol = new Map<string, NewsItem[]>();
  try {
    for (const stock of stocks) {
      const items = await fetchGoogleNews(env, stock, browserContext, newsBodyConfig);
      newsBySymbol.set(stock.symbol, items);
    }
  } finally {
    if (browserContext) {
      await browserContext.close().catch(() => undefined);
    }
    if (browserToClose) {
      await browserToClose.close().catch(() => undefined);
    }
  }
  options?.captureNewsBodyDebug?.(
    buildNewsBodyDebugSummary(newsBySymbol, {
      enabled: newsBodyConfig.enabled,
      perStockLimit: newsBodyConfig.perStockLimit,
      browserBindingConfigured: Boolean(env.BROWSER),
      browserContextReady: Boolean(browserContext)
    })
  );

  const reportDateEt = formatDate(new Date(), ET_TIMEZONE);
  const aiSummary = await buildAiSummary(env, stocks, quotes, newsBySymbol);
  const createdAt = new Date().toISOString();

  await persistReportToD1(env, {
    reportDateEt,
    quotes,
    newsBySymbol,
    stockSummaryBySymbol: aiSummary.stockSummaryBySymbol,
    marketOverviewZh: aiSummary.morningBriefZh,
    marketOverviewEn: aiSummary.morningBriefEn,
    requireDb: options?.requireDb ?? false
  });

  if (env.WEBHOOK_URL) {
    await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportDateEt,
        createdAt,
        sampleSize: quotes.length,
        validQuoteCount: quotes.length
      })
    });
  }

  return buildStructuredReport({
    reportDateEt,
    createdAt,
    stocks,
    quotes,
    newsBySymbol,
    marketOverviewZh: aiSummary.morningBriefZh,
    marketOverviewEn: aiSummary.morningBriefEn
  });
}

async function getStockUniverse(env: Env): Promise<Stock[]> {
  if (!env.DB) {
    return DEFAULT_STOCKS;
  }

  try {
    await ensureD1Schema(env.DB);
    const items = await listStocksFromD1(env.DB, { includeInactive: false });
    if (items.length === 0) {
      const all = await listStocksFromD1(env.DB, { includeInactive: true });
      if (all.length > 0) {
        return [];
      }
      return DEFAULT_STOCKS;
    }

    return items.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      displayName: item.displayName,
      codes: item.codes,
      businessType: item.businessType,
      aliases: item.aliases
    }));
  } catch {
    return DEFAULT_STOCKS;
  }
}

function parseBooleanQuery(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isLocalDevDebugRequest(requestUrl: string): boolean {
  try {
    const { hostname } = new URL(requestUrl);
    const normalized = hostname.trim().toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
  } catch {
    return false;
  }
}

function createLocalizedText(zh: string | null, en: string | null): LocalizedText {
  return { zh, en };
}

function isAdminRequestAuthorized(token: string | undefined, env: Env): boolean {
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return false;
  }
  return token === expected;
}

function ensureAdminToken(
  token: string | undefined,
  env: Env
): { status: number; message: string } | null {
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return { status: 500, message: "ADMIN_TOKEN is not configured." };
  }
  if (token !== expected) {
    return { status: 401, message: "Unauthorized." };
  }
  return null;
}

async function readJsonSafe(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeStringField(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  return normalized.slice(0, maxLength);
}

function normalizeSymbol(value: unknown): string | undefined {
  const normalized = normalizeStringField(value, 32);
  return normalized ? normalized.toUpperCase() : undefined;
}

function normalizeSortOrder(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }
  if (value < -1_000_000 || value > 1_000_000) {
    return undefined;
  }
  return value;
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function normalizeAliasesField(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const raw = value.filter((item): item is string => typeof item === "string");
  const normalized = normalizeAliasList(raw);
  return normalized.length > 0 ? normalized : [];
}

function parseStockPreviewInput(payload: unknown): ParseResult<StockPreviewInput> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload must be an object." };
  }

  const body = payload as Record<string, unknown>;
  const name = normalizeStringField(body.name);
  if (!name) {
    return { ok: false, error: "name is required." };
  }

  return { ok: true, value: { name } };
}

function parseStockMutationInput(
  payload: unknown,
  options: { requireSymbol: boolean }
): ParseResult<StockMutationInput> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload must be an object." };
  }

  const body = payload as Record<string, unknown>;
  const symbol = normalizeSymbol(body.symbol);
  const name = normalizeStringField(body.name);
  const displayName = normalizeStringField(body.displayName);
  const codes = normalizeStringField(body.codes);
  const businessType = normalizeStringField(body.businessType);
  const aliases = normalizeAliasesField(body.aliases);
  const sortOrder = normalizeSortOrder(body.sortOrder);
  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

  if (options.requireSymbol && !symbol) {
    return { ok: false, error: "symbol is required." };
  }

  const parsed: StockMutationInput = {
    symbol,
    name,
    displayName,
    codes,
    businessType,
    aliases,
    sortOrder,
    isActive
  };

  if (
    !options.requireSymbol &&
    symbol === undefined &&
    name === undefined &&
    displayName === undefined &&
    codes === undefined &&
    businessType === undefined &&
    aliases === undefined &&
    sortOrder === undefined &&
    isActive === undefined
  ) {
    return { ok: false, error: "At least one updatable field is required." };
  }

  return { ok: true, value: parsed };
}

function tryParseJsonValue(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function extractJsonValue(raw: string): unknown | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = tryParseJsonValue(trimmed);
  if (direct !== undefined) {
    return direct;
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const objectValue = tryParseJsonValue(trimmed.slice(objectStart, objectEnd + 1));
    if (objectValue !== undefined) {
      return objectValue;
    }
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return tryParseJsonValue(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  return undefined;
}

function parsePreviewCandidatesFromAi(raw: string): Array<Record<string, unknown>> {
  const parsed = extractJsonValue(raw);
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }
  if (parsed && typeof parsed === "object") {
    const candidates = (parsed as Record<string, unknown>).candidates;
    if (Array.isArray(candidates)) {
      return candidates.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }
  return [];
}

function makePreviewSymbolWithIndex(seed: string, index: number): string {
  const normalizedSeed = normalizeSymbol(seed) ?? `STK${Date.now().toString(36).toUpperCase()}`;
  const suffix = index === 0 ? "" : String(index + 1);
  const maxBaseLength = Math.max(1, 32 - suffix.length);
  return `${normalizedSeed.slice(0, maxBaseLength)}${suffix}`;
}

function buildAliasOwnerMap(items: StockAdminItem[]): Map<string, string> {
  const ownerByAlias = new Map<string, string>();
  for (const item of items) {
    if (!item.isActive) {
      continue;
    }
    for (const alias of item.aliases) {
      ownerByAlias.set(alias.toLowerCase(), item.symbol);
    }
  }
  return ownerByAlias;
}

function filterAliasesByOwnerMap(aliases: string[], symbol: string, ownerByAlias: Map<string, string>): string[] {
  return aliases.filter((alias) => {
    const owner = ownerByAlias.get(alias.toLowerCase());
    return !owner || owner === symbol;
  });
}

function buildNameConflictWarnings(name: string, items: StockAdminItem[]): string[] {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const exact = items.find((item) => item.name.trim().toLowerCase() === normalized);
  if (exact) {
    return [`名称与现有股票重复：${exact.name}（${exact.symbol}）`];
  }

  const similar = items
    .filter((item) => {
      const current = item.name.trim().toLowerCase();
      return current.includes(normalized) || normalized.includes(current);
    })
    .slice(0, 2)
    .map((item) => `${item.name}（${item.symbol}）`);
  if (similar.length > 0) {
    return [`名称与已有股票相近：${similar.join("、")}`];
  }

  return [];
}

async function buildStockPreview(
  env: Env,
  input: StockPreviewInput
): Promise<{ inputName: string; candidates: StockPreviewCandidate[]; globalWarnings: string[] }> {
  const existingItems = env.DB ? await listStocksFromD1(env.DB, { includeInactive: true }) : [];
  const ownerByAlias = buildAliasOwnerMap(existingItems);
  const existingSymbols = new Set(existingItems.map((item) => item.symbol.toLowerCase()));
  const nameWarnings = buildNameConflictWarnings(input.name, existingItems);

  const seed = buildSymbolSeedFromName(input.name);
  const knownSymbols = existingItems
    .map((item) => item.symbol)
    .slice(0, 120)
    .join(", ");
  const aiPrompt = [
    "请根据输入股票名称生成最多3个候选股票信息，用于股票池新增预览。",
    "必须输出 JSON，格式如下：",
    '{"candidates":[{"symbol":"","name":"","displayName":"","codes":"","businessType":"","aliases":[""]}]}',
    "要求：",
    "1) 只输出 JSON，不要任何解释文本；",
    "2) symbol 使用大写，港股可用 0700.HK；",
    "3) aliases 提供中英文简称与代码写法。",
    `输入名称: ${input.name}`,
    `默认 symbol 种子: ${seed}`,
    knownSymbols ? `已存在 symbol 列表(节选): ${knownSymbols}` : "已存在 symbol 列表: 无"
  ].join("\n");

  const aiRaw = await callAiCompatible(
    env,
    "你是股票池维护助手。严格返回 JSON 对象，不允许额外文本。",
    aiPrompt
  );

  const aiCandidates = aiRaw ? parsePreviewCandidatesFromAi(aiRaw).slice(0, 3) : [];
  const globalWarnings: string[] = [];
  if (!aiRaw) {
    globalWarnings.push("AI 预览不可用，已返回规则生成候选。");
  } else if (aiCandidates.length === 0) {
    globalWarnings.push("AI 返回无法解析，已返回规则生成候选。");
  }

  const candidates: StockPreviewCandidate[] = [];
  const usedSymbols = new Set<string>();
  const maxCandidates = Math.max(3, aiCandidates.length || 0);

  for (let index = 0; index < maxCandidates; index += 1) {
    const rawCandidate = aiCandidates[index] ?? {};
    const fallbackSymbol = makePreviewSymbolWithIndex(seed, index);
    let symbol = normalizeSymbol(rawCandidate.symbol) ?? fallbackSymbol;
    if (usedSymbols.has(symbol.toLowerCase())) {
      let attempt = index + 1;
      while (usedSymbols.has(symbol.toLowerCase())) {
        symbol = makePreviewSymbolWithIndex(symbol, attempt);
        attempt += 1;
      }
    }

    const name = normalizeStringField(rawCandidate.name) ?? input.name;
    const displayName =
      normalizeStringField(rawCandidate.displayName) ??
      (name === symbol ? symbol : `${name} (${symbol})`);
    const codes = normalizeStringField(rawCandidate.codes) ?? symbol;
    const businessType = normalizeStringField(rawCandidate.businessType) ?? "N/A";
    const aiAliases = normalizeAliasesField(rawCandidate.aliases) ?? [];
    const seedAliases = collectAliasCandidates({ symbol, name, displayName, codes });
    const mergedAliases = normalizeAliasList([...seedAliases, ...aiAliases]);
    const aliases = filterAliasesByOwnerMap(mergedAliases, symbol, ownerByAlias);

    const warnings: string[] = [];
    if (existingSymbols.has(symbol.toLowerCase())) {
      warnings.push(`symbol 已存在：${symbol}`);
    }
    for (const warning of nameWarnings) {
      if (!warnings.includes(warning)) {
        warnings.push(warning);
      }
    }
    const normalizedCandidate: StockPreviewCandidate = {
      symbol,
      name,
      displayName,
      codes,
      businessType,
      aliases,
      warnings: warnings.slice(0, 6)
    };

    if (usedSymbols.has(normalizedCandidate.symbol.toLowerCase())) {
      continue;
    }
    usedSymbols.add(normalizedCandidate.symbol.toLowerCase());
    candidates.push(normalizedCandidate);

    if (candidates.length >= 3) {
      break;
    }
  }

  if (candidates.length === 0) {
    const symbol = makePreviewSymbolWithIndex(seed, 0);
    const displayName = input.name === symbol ? symbol : `${input.name} (${symbol})`;
    candidates.push({
      symbol,
      name: input.name,
      displayName,
      codes: symbol,
      businessType: "N/A",
      aliases: normalizeAliasList([symbol, input.name, displayName]),
      warnings: nameWarnings
    });
  }

  return {
    inputName: input.name,
    candidates,
    globalWarnings
  };
}

function parseAliasesJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function stockRowToItem(row: StockRecord): StockAdminItem {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    displayName: row.displayName,
    codes: row.codes,
    businessType: row.businessType,
    aliases: parseAliasesJson(row.aliasesJson),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

function defaultStockToAdminItem(stock: Stock, index: number): StockAdminItem {
  return {
    id: index + 1,
    symbol: stock.symbol,
    name: stock.name,
    displayName: stock.displayName,
    codes: stock.codes,
    businessType: stock.businessType,
    aliases: stock.aliases,
    isActive: true,
    sortOrder: (index + 1) * 10,
    createdAt: "",
    updatedAt: "",
    deletedAt: null
  };
}

function getDefaultStockItem(symbol: string): StockAdminItem | null {
  const index = DEFAULT_STOCKS.findIndex((item) => normalizeSymbol(item.symbol) === symbol);
  if (index === -1) {
    return null;
  }
  return defaultStockToAdminItem(DEFAULT_STOCKS[index], index);
}

function toQuoteSnapshot(row: {
  close: number;
  previousClose: number;
  changePct: number;
  volume: number;
  turnoverEstimate: number;
  currency: string;
}): StockQuoteSnapshot {
  return {
    close: row.close,
    previousClose: row.previousClose,
    changePct: row.changePct,
    volume: row.volume,
    turnoverEstimate: row.turnoverEstimate,
    currency: row.currency
  };
}

async function listStocksFromD1(
  dbBinding: D1Database,
  options: { includeInactive: boolean }
): Promise<StockAdminItem[]> {
  const db = drizzle(dbBinding);
  const rows = options.includeInactive
    ? await db.select().from(stocksTable).orderBy(asc(stocksTable.sortOrder), asc(stocksTable.id))
    : await db
        .select()
        .from(stocksTable)
        .where(eq(stocksTable.isActive, true))
        .orderBy(asc(stocksTable.sortOrder), asc(stocksTable.id));
  return rows.map(stockRowToItem);
}

async function getStockRowById(dbBinding: D1Database, stockId: number): Promise<StockRecord | null> {
  const db = drizzle(dbBinding);
  const rows = await db.select().from(stocksTable).where(eq(stocksTable.id, stockId)).limit(1);
  return rows[0] ?? null;
}

async function getStockRowBySymbol(dbBinding: D1Database, symbol: string): Promise<StockRecord | null> {
  const db = drizzle(dbBinding);
  const rows = await db.select().from(stocksTable).where(eq(stocksTable.symbol, symbol)).limit(1);
  return rows[0] ?? null;
}

async function getPublicStockDetail(env: Env, symbol: string): Promise<StockDetailPayload | null> {
  if (!env.DB) {
    const stock = getDefaultStockItem(symbol);
    if (!stock) {
      return null;
    }

    return {
      stock,
      latestReportDateEt: null,
      latestQuote: null,
      latestAiSummary: createLocalizedText(null, null),
      recentNews: [],
      history: [],
      reportRecords: []
    };
  }

  await ensureD1Schema(env.DB);

  const stockRow = await getStockRowBySymbol(env.DB, symbol);
  if (stockRow && !stockRow.isActive) {
    return null;
  }
  const stock = stockRow ? stockRowToItem(stockRow) : getDefaultStockItem(symbol);
  if (!stock) {
    return null;
  }

  const db = drizzle(env.DB);
  const historyRows = await db
    .select({
      reportDateEt: reportRuns.reportDateEt,
      close: reportQuotes.close,
      previousClose: reportQuotes.previousClose,
      changePct: reportQuotes.changePct,
      volume: reportQuotes.volume,
      turnoverEstimate: reportQuotes.turnoverEstimate,
      currency: reportQuotes.currency
    })
    .from(reportQuotes)
    .innerJoin(reportRuns, eq(reportRuns.id, reportQuotes.runId))
    .where(eq(reportQuotes.symbol, symbol))
    .orderBy(desc(reportRuns.reportDateEt), desc(reportQuotes.id))
    .limit(30);

  const history = historyRows.map((row) => ({
    reportDateEt: row.reportDateEt,
    close: row.close,
    previousClose: row.previousClose,
    changePct: row.changePct,
    volume: row.volume,
    turnoverEstimate: row.turnoverEstimate,
    currency: row.currency
  }));

  const latestQuote = history[0] ? toQuoteSnapshot(history[0]) : null;
  const latestReportDateEt = history[0]?.reportDateEt ?? null;

  const recentNews = await db
    .select({
      title: reportNews.title,
      link: reportNews.link,
      source: reportNews.source,
      publishedAt: reportNews.publishedAt
    })
    .from(reportNews)
    .innerJoin(reportRuns, eq(reportRuns.id, reportNews.runId))
    .where(eq(reportNews.symbol, symbol))
    .orderBy(desc(reportRuns.reportDateEt), desc(reportNews.publishedAt), desc(reportNews.id))
    .limit(8);

  const latestSummaryRows = await db
    .select({
      aiSummaryZh: reportNews.aiSummary,
      aiSummaryEn: reportNews.aiSummaryEn
    })
    .from(reportNews)
    .innerJoin(reportRuns, eq(reportRuns.id, reportNews.runId))
    .where(
      and(
        eq(reportNews.symbol, symbol),
        or(
          sql`(${reportNews.aiSummary} IS NOT NULL AND TRIM(${reportNews.aiSummary}) <> '')`,
          sql`(${reportNews.aiSummaryEn} IS NOT NULL AND TRIM(${reportNews.aiSummaryEn}) <> '')`
        )
      )
    )
    .orderBy(desc(reportRuns.reportDateEt), desc(reportNews.id))
    .limit(1);
  const latestSummaryRow = latestSummaryRows[0] ?? null;

  const reportRecordRows = await db
    .select({
      reportDateEt: reportRuns.reportDateEt,
      close: reportQuotes.close,
      changePct: reportQuotes.changePct,
      newsCount: sql<number>`COUNT(${reportNews.id})`,
      aiSummaryZh: sql<string | null>`MAX(CASE WHEN ${reportNews.aiSummary} IS NOT NULL AND TRIM(${reportNews.aiSummary}) <> '' THEN ${reportNews.aiSummary} END)`,
      aiSummaryEn: sql<string | null>`MAX(CASE WHEN ${reportNews.aiSummaryEn} IS NOT NULL AND TRIM(${reportNews.aiSummaryEn}) <> '' THEN ${reportNews.aiSummaryEn} END)`
    })
    .from(reportQuotes)
    .innerJoin(reportRuns, eq(reportRuns.id, reportQuotes.runId))
    .leftJoin(
      reportNews,
      and(eq(reportNews.runId, reportQuotes.runId), eq(reportNews.symbol, reportQuotes.symbol))
    )
    .where(eq(reportQuotes.symbol, symbol))
    .groupBy(reportQuotes.id, reportRuns.reportDateEt, reportQuotes.close, reportQuotes.changePct)
    .orderBy(desc(reportRuns.reportDateEt), desc(reportQuotes.id))
    .limit(8);

  return {
    stock,
    latestReportDateEt,
    latestQuote,
    latestAiSummary: createLocalizedText(
      latestSummaryRow?.aiSummaryZh?.trim() || null,
      latestSummaryRow?.aiSummaryEn?.trim() || null
    ),
    recentNews,
    history,
    reportRecords: reportRecordRows.map((row) => ({
      reportDateEt: row.reportDateEt,
      close: row.close,
      changePct: row.changePct,
      newsCount: Number(row.newsCount),
      aiSummary: createLocalizedText(row.aiSummaryZh?.trim() || null, row.aiSummaryEn?.trim() || null)
    }))
  };
}

function buildSymbolSeedFromName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  if (normalized.length > 0) {
    return normalized.slice(0, 24);
  }
  return `STK${Date.now().toString(36).toUpperCase()}`;
}

async function allocateUniqueStockSymbol(dbBinding: D1Database, seed: string): Promise<string> {
  const normalizedSeed = normalizeSymbol(seed) ?? `STK${Date.now().toString(36).toUpperCase()}`;
  const base = normalizedSeed.slice(0, 28);

  for (let index = 0; index < 500; index += 1) {
    const suffix = index === 0 ? "" : String(index + 1);
    const maxBaseLength = Math.max(1, 32 - suffix.length);
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    const existing = await getStockRowBySymbol(dbBinding, candidate);
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Failed to allocate unique stock symbol.");
}

async function getNextSortOrder(dbBinding: D1Database): Promise<number> {
  const db = drizzle(dbBinding);
  const rows = await db
    .select({ sortOrder: stocksTable.sortOrder })
    .from(stocksTable)
    .orderBy(desc(stocksTable.sortOrder))
    .limit(1);
  return (rows[0]?.sortOrder ?? 0) + 10;
}

type StockMutationResult =
  | { ok: true; item: StockAdminItem }
  | { ok: false; status: number; error: string };

async function createStock(env: Env, input: StockMutationInput): Promise<StockMutationResult> {
  if (!env.DB) {
    return { ok: false, status: 400, error: "DB is required." };
  }

  const normalizedName = input.name?.trim();
  if (!input.symbol && !normalizedName) {
    return { ok: false, status: 400, error: "name is required when symbol is omitted." };
  }

  let symbol = input.symbol;
  if (!symbol) {
    try {
      symbol = await allocateUniqueStockSymbol(env.DB, buildSymbolSeedFromName(normalizedName ?? ""));
    } catch {
      return { ok: false, status: 500, error: "Failed to generate unique stock symbol." };
    }
  }

  const existing = await getStockRowBySymbol(env.DB, symbol);
  if (existing) {
    return { ok: false, status: 409, error: "Stock symbol already exists." };
  }

  const name = normalizedName ?? symbol;
  const displayName = input.displayName ?? (name === symbol ? symbol : `${name} (${symbol})`);
  const db = drizzle(env.DB);
  const sortOrder = input.sortOrder ?? (await getNextSortOrder(env.DB));
  const nowDeletedAt = input.isActive === false ? sql`CURRENT_TIMESTAMP` : null;

  await db.insert(stocksTable).values({
    symbol,
    name,
    displayName,
    codes: input.codes ?? symbol,
    businessType: input.businessType ?? "N/A",
    aliasesJson: "[]",
    isActive: input.isActive ?? true,
    sortOrder,
    deletedAt: nowDeletedAt
  });

  const created = await getStockRowBySymbol(env.DB, symbol);
  if (!created) {
    return { ok: false, status: 500, error: "Failed to create stock." };
  }

  const aliases =
    input.aliases !== undefined
      ? await filterConflictingAliases(env.DB, normalizeAliasList(input.aliases), created.symbol, created.id)
      : await buildAliasesForStock(env, stockRowToItem(created), created.id);
  await db
    .update(stocksTable)
    .set({ aliasesJson: JSON.stringify(aliases), updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(stocksTable.id, created.id));

  const latest = await getStockRowById(env.DB, created.id);
  if (!latest) {
    return { ok: false, status: 500, error: "Failed to load created stock." };
  }
  return { ok: true, item: stockRowToItem(latest) };
}

async function updateStock(env: Env, stockId: number, input: StockMutationInput): Promise<StockMutationResult> {
  if (!env.DB) {
    return { ok: false, status: 400, error: "DB is required." };
  }

  const current = await getStockRowById(env.DB, stockId);
  if (!current) {
    return { ok: false, status: 404, error: "Stock not found." };
  }

  const nextSymbol = input.symbol ?? current.symbol;
  const db = drizzle(env.DB);
  const conflict = await db
    .select({ id: stocksTable.id })
    .from(stocksTable)
    .where(and(eq(stocksTable.symbol, nextSymbol), ne(stocksTable.id, stockId)))
    .limit(1);
  if (conflict.length > 0) {
    return { ok: false, status: 409, error: "Stock symbol already exists." };
  }

  const nextName = input.name ?? current.name;
  const nextDisplayName =
    input.displayName ?? current.displayName ?? (nextName === nextSymbol ? nextSymbol : `${nextName} (${nextSymbol})`);
  const nextIsActive = input.isActive ?? current.isActive;

  await db
    .update(stocksTable)
    .set({
      symbol: nextSymbol,
      name: nextName,
      displayName: nextDisplayName,
      codes: input.codes ?? current.codes,
      businessType: input.businessType ?? current.businessType,
      sortOrder: input.sortOrder ?? current.sortOrder,
      isActive: nextIsActive,
      deletedAt: nextIsActive ? null : sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(stocksTable.id, stockId));

  const updated = await getStockRowById(env.DB, stockId);
  if (!updated) {
    return { ok: false, status: 500, error: "Failed to load updated stock." };
  }

  const aliases =
    input.aliases !== undefined
      ? await filterConflictingAliases(env.DB, normalizeAliasList(input.aliases), updated.symbol, stockId)
      : await buildAliasesForStock(env, stockRowToItem(updated), stockId);
  await db
    .update(stocksTable)
    .set({ aliasesJson: JSON.stringify(aliases), updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(stocksTable.id, stockId));

  const latest = await getStockRowById(env.DB, stockId);
  if (!latest) {
    return { ok: false, status: 500, error: "Failed to load updated stock." };
  }
  return { ok: true, item: stockRowToItem(latest) };
}

function collectAliasCandidates(stock: Pick<StockAdminItem, "symbol" | "name" | "displayName" | "codes">): string[] {
  const codeParts = stock.codes
    .split(/[\/,，]+/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [stock.symbol, stock.name, stock.displayName, stock.codes, ...codeParts]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeAliasList(input: string[]): string[] {
  const blocked = new Set(["股票", "港股", "美股", "公司", "集团"]);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    const normalized = item.trim();
    if (normalized.length < 2 || normalized.length > 40) {
      continue;
    }
    const lower = normalized.toLowerCase();
    if (blocked.has(normalized) || seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    out.push(normalized);
    if (out.length >= 24) {
      break;
    }
  }

  return out;
}

function extractJsonArray(raw: string): string[] {
  const trimmed = raw.trim();
  const direct = tryParseAliasJson(trimmed);
  if (direct) {
    return direct;
  }

  const first = trimmed.indexOf("[");
  const last = trimmed.lastIndexOf("]");
  if (first >= 0 && last > first) {
    return tryParseAliasJson(trimmed.slice(first, last + 1)) ?? [];
  }
  return [];
}

function tryParseAliasJson(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

async function filterConflictingAliases(
  dbBinding: D1Database,
  aliases: string[],
  symbol: string,
  selfId?: number
): Promise<string[]> {
  const db = drizzle(dbBinding);
  const rows = await db
    .select({ id: stocksTable.id, symbol: stocksTable.symbol, aliasesJson: stocksTable.aliasesJson })
    .from(stocksTable)
    .where(
      and(
        eq(stocksTable.isActive, true),
        selfId ? ne(stocksTable.id, selfId) : sql`1 = 1`
      )
    );

  const occupied = new Map<string, string>();
  for (const row of rows) {
    const values = parseAliasesJson(row.aliasesJson);
    for (const alias of values) {
      occupied.set(alias.toLowerCase(), row.symbol);
    }
  }

  return aliases.filter((alias) => {
    const owner = occupied.get(alias.toLowerCase());
    return !owner || owner === symbol;
  });
}

async function buildAliasesForStock(
  env: Env,
  stock: Pick<StockAdminItem, "symbol" | "name" | "displayName" | "codes">,
  selfId?: number
): Promise<string[]> {
  const seed = collectAliasCandidates(stock);
  const aiPrompt = [
    "请为下面这只股票生成别名数组（JSON string array）。",
    "要求：只输出 JSON 数组，不要解释；包含中英文常见简称、代码写法；不要输出泛词。",
    `symbol: ${stock.symbol}`,
    `name: ${stock.name}`,
    `displayName: ${stock.displayName}`,
    `codes: ${stock.codes}`
  ].join("\n");
  const aiRaw = await callAiCompatible(
    env,
    "你是金融数据清洗助手。严格输出 JSON string array，不能输出任何额外文本。",
    aiPrompt
  );

  const aiAliases = aiRaw ? extractJsonArray(aiRaw) : [];
  const merged = normalizeAliasList([...seed, ...aiAliases]);
  if (!env.DB) {
    return merged;
  }
  return filterConflictingAliases(env.DB, merged, stock.symbol, selfId);
}

async function fetchQuote(stock: Stock): Promise<Quote | null> {
  try {
    const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      stock.symbol
    )}?interval=1d&range=5d`;

    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            currency?: string;
          };
          indicators?: {
            quote?: Array<{
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
        }>;
      };
    };

    const result = payload.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const closes = (quote?.close ?? []).filter((value): value is number => typeof value === "number");
    const volumes = (quote?.volume ?? []).filter((value): value is number => typeof value === "number");

    if (closes.length < 2) {
      return null;
    }

    const close = closes[closes.length - 1];
    const previousClose = closes[closes.length - 2];
    const changePct = previousClose === 0 ? 0 : ((close - previousClose) / previousClose) * 100;
    const volume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
    const turnoverEstimate = close * volume;

    return {
      symbol: stock.symbol,
      name: stock.name,
      close,
      previousClose,
      changePct,
      volume,
      turnoverEstimate,
      currency: result?.meta?.currency ?? "USD"
    };
  } catch {
    return null;
  }
}

async function fetchGoogleNews(
  env: Env,
  stock: Stock,
  browserContext?: BrowserContext | null,
  newsBodyConfig?: { enabled: boolean; perStockLimit: number; timeoutMs: number; maxChars: number }
): Promise<NewsItem[]> {
  try {
    const searchRequests = buildGoogleNewsSearchRequests(stock);
    const rssResponses = await Promise.all(
      searchRequests.map(async (request) => {
        const response = await fetch(request.endpoint, {
          headers: {
            "user-agent": "Mozilla/5.0"
          }
        });
        return response.ok ? response.text() : null;
      })
    );

    const items = rssResponses
      .flatMap((xml) => (xml ? parseRss(xml) : []))
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .filter((item) => isRelevantNews(item.title, stock))
      .map((item) => ({ ...item, symbol: stock.symbol }));
    const deduped = dedupeNews(items).slice(0, 5);

    const config = newsBodyConfig ?? getNewsBodyFetchConfig(env);
    if (!config.enabled || config.perStockLimit <= 0 || deduped.length === 0) {
      return deduped;
    }

    if (!browserContext) {
      return deduped;
    }

    return enrichNewsBodySnippetsWithBrowserContext(browserContext, deduped, config);
  } catch {
    return [];
  }
}

async function enrichNewsBodySnippetsWithBrowserContext(
  browserContext: BrowserContext,
  items: NewsItem[],
  options: { perStockLimit: number; timeoutMs: number; maxChars: number }
): Promise<NewsItem[]> {
  try {
    const enriched: NewsItem[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (index >= options.perStockLimit) {
        enriched.push(item);
        continue;
      }

      const bodySnippet = await fetchNewsBodySnippetWithBrowserPage(browserContext, item.link, {
        timeoutMs: options.timeoutMs,
        maxChars: options.maxChars
      });
      enriched.push(bodySnippet ? { ...item, bodySnippet } : item);
    }

    return enriched;
  } catch (error) {
    console.error(`[stocks][news-body] Browser rendering extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    return items;
  }
}

function buildGoogleNewsSearchRequests(stock: Stock): Array<{ endpoint: string }> {
  const requests: Array<{ endpoint: string }> = [];
  const seenQueries = new Set<string>();
  const englishQuery = `${stock.symbol} ${stock.name} stock`;

  const chineseKeywords = extractChineseKeywords([stock.displayName, stock.name, stock.codes, ...stock.aliases]);
  const chineseQuery = chineseKeywords[0] ? `${stock.symbol} ${chineseKeywords[0]} 股票` : "";

  const candidates = [
    { query: englishQuery, hl: "en-US", gl: "US", ceid: "US:en" },
    { query: chineseQuery, hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" }
  ];

  for (const candidate of candidates) {
    const query = candidate.query.trim();
    if (!query) {
      continue;
    }

    const normalized = normalizeTitle(query);
    if (!normalized || seenQueries.has(normalized)) {
      continue;
    }
    seenQueries.add(normalized);

    const endpoint =
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
      `&hl=${encodeURIComponent(candidate.hl)}` +
      `&gl=${encodeURIComponent(candidate.gl)}` +
      `&ceid=${encodeURIComponent(candidate.ceid)}`;
    requests.push({ endpoint });
  }

  if (requests.length === 0) {
    const fallbackQuery = `${stock.symbol} stock`;
    requests.push({
      endpoint:
        `https://news.google.com/rss/search?q=${encodeURIComponent(fallbackQuery)}` +
        "&hl=en-US&gl=US&ceid=US:en"
    });
  }

  return requests;
}

function extractChineseKeywords(entries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of entries) {
    const matches = entry.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
    for (const match of matches) {
      if (seen.has(match)) {
        continue;
      }
      seen.add(match);
      out.push(match);
    }
  }

  return out;
}

function getNewsBodyFetchConfig(env: Env): {
  enabled: boolean;
  perStockLimit: number;
  timeoutMs: number;
  maxChars: number;
} {
  return {
    enabled: parseBooleanEnv(env.NEWS_BODY_FETCH_ENABLED, NEWS_BODY_FETCH_ENABLED_DEFAULT),
    perStockLimit: parseIntEnv(env.NEWS_BODY_PER_STOCK_LIMIT, NEWS_BODY_PER_STOCK_LIMIT_DEFAULT, 0, 5),
    timeoutMs: parseIntEnv(env.NEWS_BODY_TIMEOUT_MS, NEWS_BODY_TIMEOUT_MS_DEFAULT, 1000, 15000),
    maxChars: parseIntEnv(env.NEWS_BODY_MAX_CHARS, NEWS_BODY_MAX_CHARS_DEFAULT, 120, 3000)
  };
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function parseIntEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

async function fetchNewsBodySnippetWithBrowserPage(
  context: BrowserContext,
  url: string,
  options: { timeoutMs: number; maxChars: number }
): Promise<string | null> {
  const page = await context.newPage();
  const redirectTimeoutMs = Math.max(1000, Math.floor(options.timeoutMs / 2));
  const settleTimeoutMs = Math.max(600, Math.floor(options.timeoutMs / 3));

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs
    });

    if (isGoogleNewsUrl(page.url())) {
      await page
        .waitForURL((nextUrl: URL) => !isGoogleNewsHost(nextUrl.hostname), {
          timeout: redirectTimeoutMs
        })
        .catch(() => undefined);
    }

    await page.waitForLoadState("domcontentloaded", { timeout: settleTimeoutMs }).catch(() => undefined);

    const finalUrl = page.url();
    if (isGoogleNewsUrl(finalUrl)) {
      return null;
    }

    return extractNewsBodySnippetFromHtml(await page.content(), options.maxChars, finalUrl);
  } catch {
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}

function isGoogleNewsUrl(url: string): boolean {
  try {
    return isGoogleNewsHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isGoogleNewsHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "news.google.com" || normalized.endsWith(".news.google.com");
}

function extractNewsBodySnippetFromHtml(html: string, maxChars: number, sourceUrl: string): string | null {
  const readabilityText = extractReadabilityText(html, sourceUrl);
  if (readabilityText && !isLowValueSnippet(readabilityText)) {
    return truncateByChars(readabilityText, maxChars);
  }

  const metaDescription = extractMetaDescription(html);
  if (metaDescription && !isLowValueSnippet(metaDescription)) {
    return truncateByChars(metaDescription, maxChars);
  }

  const articleText = extractArticleText(html);
  if (articleText && !isLowValueSnippet(articleText)) {
    return truncateByChars(articleText, maxChars);
  }

  const paragraphText = extractParagraphText(html);
  if (paragraphText && !isLowValueSnippet(paragraphText)) {
    return truncateByChars(paragraphText, maxChars);
  }

  return null;
}

function extractReadabilityText(html: string, _sourceUrl: string): string | null {
  try {
    const { document } = parseHTML(html);
    const parsed = new Readability(document as never).parse();

    const content = sanitizeParagraph(parsed?.textContent ?? "");
    return content || null;
  } catch {
    return null;
  }
}

function isLowValueSnippet(input: string): boolean {
  const normalized = input.toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized.length < 30) {
    return true;
  }
  if (normalized.includes("comprehensive up-to-date news coverage") && normalized.includes("google news")) {
    return true;
  }
  return false;
}

function extractMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+content\s*=\s*["']([\s\S]*?)["'][^>]+(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const content = sanitizeParagraph(htmlDecode(stripHtmlTags(match?.[1] ?? "")));
    if (content) {
      return content;
    }
  }

  return null;
}

function extractArticleText(html: string): string | null {
  const match = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!match) {
    return null;
  }
  const content = sanitizeParagraph(htmlDecode(stripHtmlTags(match[1])));
  return content || null;
}

function extractParagraphText(html: string): string | null {
  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paragraphMatches.length === 0) {
    return null;
  }

  const joined = paragraphMatches
    .slice(0, 12)
    .map((match) => sanitizeParagraph(htmlDecode(stripHtmlTags(match[1]))))
    .filter((text) => text.length > 40)
    .slice(0, 6)
    .join(" ");

  return joined || null;
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function parseRss(xml: string): Array<Omit<NewsItem, "symbol">> {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const all: Array<Omit<NewsItem, "symbol">> = [];
  let match = itemRegex.exec(xml);

  while (match) {
    const block = match[1];
    const title = htmlDecode(extractTag(block, "title"));
    const link = htmlDecode(extractTag(block, "link"));
    const source = htmlDecode(extractTag(block, "source")) || "Unknown";
    const pubDateRaw = htmlDecode(extractTag(block, "pubDate"));
    const publishedAt = new Date(pubDateRaw);

    if (title && link && !Number.isNaN(publishedAt.getTime())) {
      all.push({ title, link, source, publishedAt });
    }

    match = itemRegex.exec(xml);
  }

  return all.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }

  return out;
}

function isRelevantNews(title: string, stock: Stock): boolean {
  const normalized = title.toLowerCase();
  const compactTitle = normalizeTitle(title);
  const aliases = [stock.symbol, stock.name, stock.displayName, stock.codes, ...stock.aliases]
    .flatMap((entry) => entry.split("/"))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return aliases.some((alias) => {
    if (alias.length <= 1) {
      return false;
    }

    if (normalized.includes(alias)) {
      return true;
    }

    const compactAlias = normalizeTitle(alias);
    return compactAlias.length > 1 && compactTitle.includes(compactAlias);
  });
}

function extractTag(input: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = input.match(regex);
  return match?.[1]?.trim() ?? "";
}

function htmlDecode(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_full, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_full, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeTitle(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
}

function sanitizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function sanitizeParagraph(input: string): string {
  return input
    .replace(/^[>\s]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateByChars(input: string, maxChars: number): string {
  const normalized = input.trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) {
    return normalized;
  }
  return `${chars.slice(0, maxChars).join("")}...`;
}

function normalizeStoredBriefText(input: string | null): string | null {
  const normalized = sanitizeParagraph((input ?? "").replace(/\r\n/g, "\n").replace(/^[\-•\s]+/, ""));
  return normalized || null;
}

function formatDate(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function formatDateTime(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return formatter.format(date);
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPrice(value: number, currency: string): string {
  if (currency === "USD") {
    return `$${value.toFixed(2)}`;
  }
  return `${value.toFixed(2)} ${currency}`;
}

function formatMoney(value: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : "";
  if (value >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(2)}K`;
  }
  return `${symbol}${value.toFixed(2)}`;
}

function countTextChars(input: string): number {
  return Array.from(input.trim()).length;
}

function countWords(input: string): number {
  return input
    .trim()
    .split(/\s+/)
    .filter((item) => item.length > 0).length;
}

function trimToSentenceBoundary(input: string, maxChars: number): string {
  const normalized = sanitizeParagraph(input);
  if (countTextChars(normalized) <= maxChars) {
    return normalized;
  }

  const clipped = Array.from(normalized).slice(0, maxChars).join("");
  const lastPunctuationIndex = Math.max(clipped.lastIndexOf("。"), clipped.lastIndexOf("！"), clipped.lastIndexOf("？"));
  if (lastPunctuationIndex >= Math.floor(maxChars * 0.6)) {
    return clipped.slice(0, lastPunctuationIndex + 1).trim();
  }
  return `${clipped.trimEnd()}。`;
}

function containsBannedPhrase(input: string, phrases: string[]): boolean {
  const normalized = input.toLowerCase();
  return phrases.some((phrase) => normalized.includes(phrase.toLowerCase()));
}

function buildStructuredReport(params: {
  reportDateEt: string;
  createdAt: string;
  stocks: Stock[];
  quotes: Quote[];
  newsBySymbol: Map<string, NewsItem[]>;
  marketOverviewZh: string;
  marketOverviewEn: string;
}): StockDailyReport {
  const { reportDateEt, createdAt, stocks, quotes, newsBySymbol, marketOverviewZh, marketOverviewEn } = params;
  const stockBySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]));
  const items: StockReportQuoteItem[] = quotes.map((quote) => {
    const stock = stockBySymbol.get(quote.symbol);
    return {
      symbol: quote.symbol,
      name: quote.name,
      displayName: stock?.displayName ?? quote.name ?? quote.symbol,
      codes: stock?.codes ?? quote.symbol,
      businessType: stock?.businessType ?? "",
      close: quote.close,
      previousClose: quote.previousClose,
      changePct: quote.changePct,
      volume: quote.volume,
      turnoverEstimate: quote.turnoverEstimate,
      currency: quote.currency
    };
  });

  const overview: StockReportOverview = {
    brief: createLocalizedText(normalizeStoredBriefText(marketOverviewZh), normalizeStoredBriefText(marketOverviewEn))
  };

  const newsGroups: StockReportNewsGroup[] = items.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    displayName: item.displayName,
    changePct: item.changePct,
    items: (newsBySymbol.get(item.symbol) ?? []).map((newsItem) => ({
      title: newsItem.title,
      link: newsItem.link,
      source: newsItem.source,
      publishedAt: newsItem.publishedAt.toISOString()
    }))
  }));

  return {
    reportDateEt,
    createdAt,
    sampleSize: items.length,
    validQuoteCount: items.length,
    overview,
    items,
    newsGroups
  };
}

function buildNewsBodyDebugSummary(
  newsBySymbol: Map<string, NewsItem[]>,
  context: {
    enabled: boolean;
    perStockLimit: number;
    browserBindingConfigured: boolean;
    browserContextReady: boolean;
  }
): NewsBodyDebugSummary {
  const symbols: NewsBodyDebugSymbolSummary[] = [];
  let totalItems = 0;
  let snippetItems = 0;

  for (const [symbol, items] of newsBySymbol.entries()) {
    totalItems += items.length;
    const itemsWithSnippet = items.filter((item) => Boolean(item.bodySnippet && item.bodySnippet.trim().length > 0));
    snippetItems += itemsWithSnippet.length;

    const sample = itemsWithSnippet[0];
    symbols.push({
      symbol,
      totalItems: items.length,
      snippetItems: itemsWithSnippet.length,
      sampleSnippet: sample?.bodySnippet ?? null,
      sampleLink: sample?.link ?? null
    });
  }

  symbols.sort((left, right) => left.symbol.localeCompare(right.symbol));

  return {
    enabled: context.enabled,
    perStockLimit: context.perStockLimit,
    browserBindingConfigured: context.browserBindingConfigured,
    browserContextReady: context.browserContextReady,
    totalItems,
    snippetItems,
    symbols
  };
}

async function getStructuredReportByDateFromD1(env: Env, reportDateEt: string): Promise<StockDailyReport | null> {
  if (!env.DB) {
    return null;
  }

  await ensureD1Schema(env.DB);
  const db = drizzle(env.DB);
  const run = (
    await db
      .select({
        id: reportRuns.id,
        reportDateEt: reportRuns.reportDateEt,
        createdAt: reportRuns.createdAt,
        marketOverviewZh: reportRuns.marketOverview,
        marketOverviewEn: reportRuns.marketOverviewEn
      })
      .from(reportRuns)
      .where(eq(reportRuns.reportDateEt, reportDateEt))
      .orderBy(desc(reportRuns.id))
      .limit(1)
  )[0];

  if (!run) {
    return null;
  }

  const quoteRows = await db
    .select({
      symbol: reportQuotes.symbol,
      name: reportQuotes.name,
      displayName: sql<string>`COALESCE(${stocksTable.displayName}, ${reportQuotes.name}, ${reportQuotes.symbol})`,
      codes: sql<string>`COALESCE(${stocksTable.codes}, ${reportQuotes.symbol})`,
      businessType: sql<string>`COALESCE(${stocksTable.businessType}, '')`,
      close: reportQuotes.close,
      previousClose: reportQuotes.previousClose,
      changePct: reportQuotes.changePct,
      volume: reportQuotes.volume,
      turnoverEstimate: reportQuotes.turnoverEstimate,
      currency: reportQuotes.currency
    })
    .from(reportQuotes)
    .leftJoin(stocksTable, eq(stocksTable.symbol, reportQuotes.symbol))
    .where(eq(reportQuotes.runId, run.id))
    .orderBy(sql`COALESCE(${stocksTable.sortOrder}, 1000000)`, asc(reportQuotes.id));

  const items: StockReportQuoteItem[] = quoteRows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    displayName: row.displayName,
    codes: row.codes,
    businessType: row.businessType,
    close: row.close,
    previousClose: row.previousClose,
    changePct: row.changePct,
    volume: row.volume,
    turnoverEstimate: row.turnoverEstimate,
    currency: row.currency
  }));
  const quoteBySymbol = new Map(items.map((item) => [item.symbol, item]));

  const newsRows = await db
    .select({
      symbol: reportNews.symbol,
      title: reportNews.title,
      link: reportNews.link,
      source: reportNews.source,
      publishedAt: reportNews.publishedAt
    })
    .from(reportNews)
    .where(eq(reportNews.runId, run.id))
    .orderBy(asc(reportNews.symbol), asc(reportNews.id));

  const newsGroupsBySymbol = new Map<string, StockReportNewsGroup>();
  for (const row of newsRows) {
    const quote = quoteBySymbol.get(row.symbol);
    const existing = newsGroupsBySymbol.get(row.symbol);
    if (existing) {
      existing.items.push({
        title: row.title,
        link: row.link,
        source: row.source,
        publishedAt: row.publishedAt
      });
      continue;
    }

    newsGroupsBySymbol.set(row.symbol, {
      symbol: row.symbol,
      name: quote?.name ?? row.symbol,
      displayName: quote?.displayName ?? quote?.name ?? row.symbol,
      changePct: quote?.changePct ?? null,
      items: [
        {
          title: row.title,
          link: row.link,
          source: row.source,
          publishedAt: row.publishedAt
        }
      ]
    });
  }

  const newsGroups = items.map((item) => {
    const existing = newsGroupsBySymbol.get(item.symbol);
    return (
      existing ?? {
        symbol: item.symbol,
        name: item.name,
        displayName: item.displayName,
        changePct: item.changePct,
        items: []
      }
    );
  });

  const overview: StockReportOverview = {
    brief: createLocalizedText(normalizeStoredBriefText(run.marketOverviewZh), normalizeStoredBriefText(run.marketOverviewEn))
  };

  return {
    reportDateEt: run.reportDateEt,
    createdAt: run.createdAt,
    sampleSize: items.length,
    validQuoteCount: items.length,
    overview,
    items,
    newsGroups
  };
}

async function getReportListFromD1(
  env: Env,
  limit: number,
  beforeId: number | null = null
): Promise<{ items: ReportListItem[]; nextCursor: string | null }> {
  if (!env.DB) {
    return { items: [], nextCursor: null };
  }

  await ensureD1Schema(env.DB);
  const db = drizzle(env.DB);
  const pageSize = limit + 1;
  const rows = beforeId
    ? await db
        .select({
          id: reportRuns.id,
          reportDateEt: reportRuns.reportDateEt,
          createdAt: reportRuns.createdAt
        })
        .from(reportRuns)
        .where(lt(reportRuns.id, beforeId))
        .orderBy(desc(reportRuns.id))
        .limit(pageSize)
    : await db
        .select({
          id: reportRuns.id,
          reportDateEt: reportRuns.reportDateEt,
          createdAt: reportRuns.createdAt
        })
        .from(reportRuns)
        .orderBy(desc(reportRuns.id))
        .limit(pageSize);

  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const items = visibleRows.map((row) => ({
    reportDateEt: row.reportDateEt,
    createdAt: row.createdAt
  }));
  const nextCursor = hasMore && visibleRows.length > 0 ? String(visibleRows[visibleRows.length - 1].id) : null;

  return { items, nextCursor };
}

function parseLimit(rawLimit: string | undefined): number | null {
  if (!rawLimit) {
    return 30;
  }

  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    return null;
  }
  return parsed;
}

function parseCursor(rawCursor: string | undefined): number | null | "invalid" {
  if (!rawCursor) {
    return null;
  }

  const parsed = Number(rawCursor);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return "invalid";
  }

  return parsed;
}

function parseMarketIndexRange(rawRange: string | undefined): MarketIndexRange | null {
  const normalized = rawRange?.trim() ?? "1m";
  if (normalized === "1m" || normalized === "3m" || normalized === "1y") {
    return normalized;
  }
  return null;
}

function parseSummaryDate(rawDate: string | undefined): string | null {
  const normalized = rawDate?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function buildMorningBriefNewsPool(stocks: Stock[], newsBySymbol: Map<string, NewsItem[]>): MorningBriefNewsItem[] {
  return stocks
    .flatMap((stock) => {
      const items = newsBySymbol.get(stock.symbol) ?? [];
      return items.map((item) => ({
        symbol: stock.symbol,
        title: sanitizeTitle(item.title),
        source: item.source,
        publishedAt: item.publishedAt,
        bodySnippet: item.bodySnippet
      }));
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

function pickMorningBriefStocks(
  stocks: Stock[],
  quoteBySymbol: Map<string, Quote>,
  newsBySymbol: Map<string, NewsItem[]>,
  allowedSymbols: Set<string>,
  limit: number
): MorningBriefContextStock[] {
  return stocks
    .filter((stock) => allowedSymbols.has(stock.symbol))
    .map((stock) => {
      const quote = quoteBySymbol.get(stock.symbol);
      return {
        symbol: stock.symbol,
        displayName: stock.displayName,
        changePct: quote?.changePct ?? null,
        newsCount: (newsBySymbol.get(stock.symbol) ?? []).length
      };
    })
    .sort((a, b) => {
      const scoreA = (a.newsCount * 2) + Math.abs(a.changePct ?? 0);
      const scoreB = (b.newsCount * 2) + Math.abs(b.changePct ?? 0);
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

async function loadMorningBriefIndicesContext(_env: Env): Promise<{ lines: string[]; enLines: string[] }> {
  try {
    const payload = await getLiveMarketIndicesLatest();
    const lines = payload.regions
      .map((group) => group.items.find((item) => item.isPrimary) ?? group.items[0])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => `${item.nameZh}${item.changePct === null ? "暂无变动" : `${formatSignedPct(item.changePct)}，最新点位${item.price ?? "-"}`}`);
    const enLines = payload.regions
      .map((group) => group.items.find((item) => item.isPrimary) ?? group.items[0])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => `${item.nameEn} ${item.changePct === null ? "had no usable move" : `moved ${formatSignedPct(item.changePct)} to ${item.price ?? "-"}`}`);
    return { lines, enLines };
  } catch {
    return { lines: [], enLines: [] };
  }
}

async function loadArchivedIndicesSummary(env: Env): Promise<string | null> {
  try {
    const payload = await getLatestMarketAiSummary(env);
    return normalizeStoredBriefText(payload.item?.summaryZh ?? null);
  } catch {
    return null;
  }
}

function isQuietMorningBriefDay(
  indicesLines: string[],
  chinaConceptStocks: MorningBriefContextStock[],
  usTechStocks: MorningBriefContextStock[],
  newsItems: MorningBriefNewsItem[]
): boolean {
  const maxChinaMove = Math.max(0, ...chinaConceptStocks.map((item) => Math.abs(item.changePct ?? 0)));
  const maxUsMove = Math.max(0, ...usTechStocks.map((item) => Math.abs(item.changePct ?? 0)));
  return indicesLines.length > 0 && maxChinaMove < 2.5 && maxUsMove < 2.5 && newsItems.length < 4;
}

function inferNewsThemeZh(items: MorningBriefNewsItem[]): string {
  if (items.length === 0) {
    return "消息面未形成明确主线";
  }

  const categories = [
    { label: "财报与业绩", keywords: ["earnings", "revenue", "profit", "guidance", "业绩", "财报", "利润", "营收"] },
    { label: "评级与目标价", keywords: ["upgrade", "downgrade", "target", "rating", "评级", "目标价", "上调", "下调"] },
    { label: "监管与政策", keywords: ["regulation", "probe", "investigation", "tariff", "监管", "政策", "调查", "审查"] },
    { label: "AI与产品进展", keywords: ["ai", "chip", "model", "launch", "云", "芯片", "模型", "发布"] }
  ];

  const counts = categories.map((category) => ({
    label: category.label,
    count: items.filter((item) => {
      const haystack = `${item.title} ${item.bodySnippet ?? ""}`.toLowerCase();
      return category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    }).length
  }));

  const top = counts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 2);
  if (top.length === 0) {
    return `消息面主要围绕${items.slice(0, 2).map((item) => item.symbol).join("、")}等个股展开`;
  }

  return `消息面主要围绕${top.map((item) => item.label).join("、")}`;
}

function inferNewsThemeEn(items: MorningBriefNewsItem[]): string {
  if (items.length === 0) {
    return "the news backdrop stayed fairly light";
  }

  if (items.some((item) => /earnings|revenue|profit|guidance/i.test(`${item.title} ${item.bodySnippet ?? ""}`))) {
    return "earnings and company updates drove most of the coverage";
  }
  if (items.some((item) => /rating|target|upgrade|downgrade/i.test(`${item.title} ${item.bodySnippet ?? ""}`))) {
    return "broker calls and target-price changes stood out in coverage";
  }
  if (items.some((item) => /regulation|probe|investigation|policy|tariff/i.test(`${item.title} ${item.bodySnippet ?? ""}`))) {
    return "regulatory and policy headlines carried most of the news flow";
  }
  return "headline flow stayed centered on company-specific updates";
}

function buildStockMoveClauseZh(label: string, items: MorningBriefContextStock[]): string {
  if (items.length === 0) {
    return `${label}暂无明显强弱线索`;
  }

  const leader = [...items]
    .filter((item) => item.changePct !== null)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
  const laggard = [...items]
    .filter((item) => item.changePct !== null)
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))[0];

  if (!leader && !laggard) {
    return `${label}行情信号有限`;
  }
  if (leader && laggard && leader.symbol !== laggard.symbol) {
    return `${label}里${leader.displayName}${formatSignedPct(leader.changePct ?? 0)}相对领先，${laggard.displayName}${formatSignedPct(laggard.changePct ?? 0)}相对承压`;
  }
  const focus = leader ?? laggard;
  return focus ? `${label}里${focus.displayName}${formatSignedPct(focus.changePct ?? 0)}最值得留意` : `${label}行情信号有限`;
}

function buildStockMoveClauseEn(label: string, items: MorningBriefContextStock[]): string {
  if (items.length === 0) {
    return `${label} lacked a clear leadership signal`;
  }

  const leader = [...items]
    .filter((item) => item.changePct !== null)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
  const laggard = [...items]
    .filter((item) => item.changePct !== null)
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))[0];

  if (leader && laggard && leader.symbol !== laggard.symbol) {
    return `within ${label}, ${leader.displayName} led at ${formatSignedPct(leader.changePct ?? 0)} while ${laggard.displayName} lagged at ${formatSignedPct(laggard.changePct ?? 0)}`;
  }
  const focus = leader ?? laggard;
  return focus ? `within ${label}, ${focus.displayName} stood out at ${formatSignedPct(focus.changePct ?? 0)}` : `${label} stayed muted`;
}

function buildFallbackMorningBriefZh(params: {
  indicesLines: string[];
  chinaConceptStocks: MorningBriefContextStock[];
  usTechStocks: MorningBriefContextStock[];
  allMarketNews: MorningBriefNewsItem[];
  quietDay: boolean;
}): string {
  const indicesClause = params.indicesLines.length > 0 ? `主要指数方面，${params.indicesLines.join("；")}` : "主要指数信号暂缺";
  const chinaClause = buildStockMoveClauseZh("中概股", params.chinaConceptStocks);
  const usClause = buildStockMoveClauseZh("美股科技龙头", params.usTechStocks);
  const newsClause = inferNewsThemeZh(params.allMarketNews);
  const quietClause = params.quietDay ? "，整体更像情绪延续而不是新的强催化日" : "，市场重心仍围绕这些名字与消息线索展开";
  let brief = sanitizeParagraph(`${indicesClause}。${chinaClause}；${usClause}。${newsClause}${quietClause}。`);
  if (countTextChars(brief) < MORNING_BRIEF_MIN_ZH_CHARS) {
    brief = sanitizeParagraph(
      `${brief} 从固定观察池内部看，资金仍主要围绕龙头品种和高频新闻线索切换，盘面节奏偏结构化，暂时没有出现能够同时带动中概与美股科技全面扩散的统一主线。`
    );
  }
  return trimToSentenceBoundary(brief, MORNING_BRIEF_MAX_ZH_CHARS);
}

function buildFallbackMorningBriefEn(params: {
  indicesLines: string[];
  chinaConceptStocks: MorningBriefContextStock[];
  usTechStocks: MorningBriefContextStock[];
  allMarketNews: MorningBriefNewsItem[];
  quietDay: boolean;
}): string {
  const indicesClause = params.indicesLines.length > 0 ? `Across major indices, ${params.indicesLines.join("; ")}` : "Major-index context was limited";
  const chinaClause = buildStockMoveClauseEn("China ADRs", params.chinaConceptStocks);
  const usClause = buildStockMoveClauseEn("US tech leaders", params.usTechStocks);
  const newsClause = inferNewsThemeEn(params.allMarketNews);
  const quietClause = params.quietDay ? "and the session looked more like a steady follow-through than a fresh catalyst day." : "and that cluster of names still set the tone for the session.";
  return sanitizeParagraph(`${indicesClause}. ${chinaClause}. ${usClause}. Overall, ${newsClause}, ${quietClause}`);
}

function normalizeMorningBriefZh(input: string | null, fallback: string): string {
  const normalized = sanitizeParagraph(
    (input ?? "")
      .replace(/^\s*(?:今日晨报|晨报导语|市场晨报|Morning Brief)\s*[：:]\s*/i, "")
      .replace(/[\r\n]+/g, " ")
  );
  if (!normalized) {
    return fallback;
  }

  const trimmed = trimToSentenceBoundary(normalized, MORNING_BRIEF_MAX_ZH_CHARS);
  if (containsBannedPhrase(trimmed, MORNING_BRIEF_BANNED_ZH)) {
    return fallback;
  }
  if (countTextChars(trimmed) < MORNING_BRIEF_MIN_ZH_CHARS) {
    return fallback;
  }
  return trimmed;
}

function normalizeMorningBriefEn(input: string): string {
  const normalized = sanitizeParagraph(input);
  if (!normalized) {
    return "Daily market context is unavailable.";
  }
  if (containsBannedPhrase(normalized, MORNING_BRIEF_BANNED_EN)) {
    return "Daily market context is unavailable.";
  }

  const words = normalized.split(/\s+/).filter((item) => item.length > 0);
  if (words.length < MORNING_BRIEF_MIN_EN_WORDS) {
    return normalized;
  }
  if (countWords(normalized) <= MORNING_BRIEF_MAX_EN_WORDS) {
    return normalized;
  }
  return `${words.slice(0, MORNING_BRIEF_MAX_EN_WORDS).join(" ")}.`;
}

async function buildAiSummary(
  env: Env,
  stocks: Stock[],
  quotes: Quote[],
  newsBySymbol: Map<string, NewsItem[]>
): Promise<ReportSummary> {
  const stockSummaryBySymbol = new Map<string, LocalizedText>();
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const allMarketNews = buildMorningBriefNewsPool(stocks, newsBySymbol);

  const indicesContext = await loadMorningBriefIndicesContext(env);
  const archivedIndicesSummary = await loadArchivedIndicesSummary(env);
  const chinaConceptStocks = pickMorningBriefStocks(stocks, quoteBySymbol, newsBySymbol, CHINA_CONCEPT_SYMBOLS, 4);
  const usTechStocks = pickMorningBriefStocks(stocks, quoteBySymbol, newsBySymbol, US_TECH_TOP10_SYMBOLS, 4);
  const notableNews = allMarketNews.slice(0, 10);
  const quietDay = isQuietMorningBriefDay(indicesContext.lines, chinaConceptStocks, usTechStocks, notableNews);

  const fallbackMorningBriefZh = buildFallbackMorningBriefZh({
    indicesLines: indicesContext.lines,
    chinaConceptStocks,
    usTechStocks,
    allMarketNews,
    quietDay
  });
  const fallbackMorningBriefEn = buildFallbackMorningBriefEn({
    indicesLines: indicesContext.enLines,
    chinaConceptStocks,
    usTechStocks,
    allMarketNews,
    quietDay
  });

  const promptSections = [
    "请把下面材料整理成一段给所有用户看的中文股市晨报导语。",
    `要求：只输出一段自然中文正文，不要标题、不要项目符号、不要分段，控制在${MORNING_BRIEF_MIN_ZH_CHARS}-${MORNING_BRIEF_MAX_ZH_CHARS}个汉字。`,
    "表达顺序优先从主要指数与跨市场气氛切入，再决定是否点名中概或美股科技龙头。只有在给定行情或新闻确实支持时才点名。",
    quietDay
      ? "当前整体信号偏平静，可以只写指数和整体情绪，不必强行加入个股。"
      : "当前存在一定个股与消息主线，请优先提炼最能代表当天气氛的名字和事件。",
    "你可以归纳行情与新闻之间的关系，但只能基于给定材料，不得补充外部事实，不得预测后续走势，不得给出投资建议。",
    "禁止使用：买入、卖出、抄底、逃顶、看好、有望、预计、将会、建议等措辞。",
    indicesContext.lines.length > 0 ? `主要指数:\n${indicesContext.lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}` : "主要指数: 无",
    archivedIndicesSummary ? `最近归档指数摘要: ${archivedIndicesSummary}` : "最近归档指数摘要: 无",
    chinaConceptStocks.length > 0
      ? `固定中概观察池:\n${chinaConceptStocks
          .map((item, index) => `${index + 1}. ${item.symbol} / ${item.displayName}，涨跌幅${formatSignedPct(item.changePct ?? 0)}，相关新闻${item.newsCount}条`)
          .join("\n")}`
      : "固定中概观察池: 无",
    usTechStocks.length > 0
      ? `固定美股科技观察池:\n${usTechStocks
          .map((item, index) => `${index + 1}. ${item.symbol} / ${item.displayName}，涨跌幅${formatSignedPct(item.changePct ?? 0)}，相关新闻${item.newsCount}条`)
          .join("\n")}`
      : "固定美股科技观察池: 无",
    notableNews.length > 0
      ? `相关新闻线索:\n${notableNews
          .map((item, index) => {
            const snippet = item.bodySnippet ? `；摘要：${sanitizeParagraph(item.bodySnippet)}` : "";
            return `${index + 1}. [${item.symbol}] ${item.title}（${item.source}，${formatDateTime(item.publishedAt, ET_TIMEZONE)} ET）${snippet}`;
          })
          .join("\n")}`
      : "相关新闻线索: 无"
  ].join("\n\n");

  let aiMorningBriefRaw: string | null = null;
  try {
    aiMorningBriefRaw = await callAiCompatible(
      env,
      "你是面向普通用户的市场晨报编辑。你只能使用给定材料写一段简洁、克制、可直接发布的中文晨报导语。不要写标题，不要写分点，不要使用投资建议或预测语言，不要补充外部知识。",
      promptSections
    );
  } catch {
    aiMorningBriefRaw = null;
  }

  const morningBriefZh = normalizeMorningBriefZh(aiMorningBriefRaw, fallbackMorningBriefZh);

  const stockSummaryPairs = await Promise.all(
    stocks.map(async (stock) => {
      const summaryZh = await buildStockNewsSummary(
        env,
        stock,
        quoteBySymbol.get(stock.symbol),
        newsBySymbol.get(stock.symbol) ?? []
      );
      const summaryEn = buildEnglishStockNewsSummary(stock, quoteBySymbol.get(stock.symbol), newsBySymbol.get(stock.symbol) ?? []);
      return [stock.symbol, createLocalizedText(summaryZh, summaryEn)] as const;
    })
  );
  for (const [symbol, summary] of stockSummaryPairs) {
    stockSummaryBySymbol.set(symbol, summary);
  }

  return { stockSummaryBySymbol, morningBriefZh, morningBriefEn: normalizeMorningBriefEn(fallbackMorningBriefEn) };
}

async function buildFallbackStockOverview(
  env: Env,
  stocks: Stock[],
  quoteBySymbol: Map<string, Quote>,
  quotes: Quote[]
): Promise<string> {
  if (quotes.length === 0) {
    return "当日股票行情数据缺失，暂无可用的市场表现结论。";
  }

  const quoteLines = stocks
    .map((stock) => {
      const quote = quoteBySymbol.get(stock.symbol);
      return quote
        ? `- ${stock.symbol} (${stock.displayName}): 收盘${formatPrice(quote.close, quote.currency)}, 涨跌幅${formatSignedPct(
            quote.changePct
          )}`
        : `- ${stock.symbol} (${stock.displayName}): 行情数据缺失`;
    })
    .join("\n");

  const prompt = [
    "请基于以下股票池行情，生成一段中文股票市场概览。",
    "要求：只讲股票市场，不提新闻；语气客观；不要投资建议；不要项目符号；50字以内。",
    `行情数据:\n${quoteLines}`
  ].join("\n\n");

  const aiRaw = await callAiCompatible(
    env,
    "你是股票日报编辑。仅输出一段中文股票市场概览，不要附加标题。",
    prompt
  );
  const normalized = sanitizeParagraph((aiRaw ?? "").replace(/^\s*(?:股票市场|第一段)\s*[：:]\s*/i, ""));
  if (normalized) {
    return normalized;
  }

  return "当日股票市场概览生成失败，请参考下方个股行情数据。";
}

async function buildStockNewsSummary(
  env: Env,
  stock: Stock,
  quote: Quote | undefined,
  items: NewsItem[]
): Promise<string> {
  const fallback = buildFallbackStockNewsSummary(stock, quote, items);
  if (items.length === 0) {
    return fallback;
  }

  const quoteLine = quote
    ? `${stock.symbol}（${stock.displayName}）收盘${formatPrice(quote.close, quote.currency)}，涨跌幅${formatSignedPct(quote.changePct)}。`
    : `${stock.symbol}（${stock.displayName}）当日行情数据缺失。`;

  const newsLines = items
    .slice(0, 5)
    .map((item, index) => {
      const snippet = item.bodySnippet ? `；正文摘要：${sanitizeParagraph(item.bodySnippet)}` : "";
      return `${index + 1}. ${sanitizeTitle(item.title)}（${item.source}）${snippet}`;
    })
    .join("\n");

  const prompt = [
    "请基于这只股票的行情与新闻，输出一段中文摘要。",
    "要求：只输出摘要正文，不要标题；聚焦新闻事件要点；语气客观；不超过180字；不要投资建议。",
    `行情：${quoteLine}`,
    `新闻:\n${newsLines}`
  ].join("\n\n");

  let aiRaw: string | null = null;
  try {
    aiRaw = await callAiCompatible(
      env,
      "你是股票个股新闻编辑。仅输出一段简洁中文摘要正文，不要附加标题或项目符号。",
      prompt
    );
  } catch {
    aiRaw = null;
  }

  const normalized = sanitizeParagraph((aiRaw ?? "").replace(/^\s*(?:要点|摘要|总结|新闻摘要)\s*[：:]\s*/i, ""));
  if (normalized) {
    return normalized;
  }

  return fallback;
}

function buildFallbackStockNewsSummary(stock: Stock, quote: Quote | undefined, items: NewsItem[]): string {
  const quoteLead = quote
    ? `${stock.symbol}当日${formatSignedPct(quote.changePct)}。`
    : `${stock.symbol}当日行情数据缺失。`;

  if (items.length === 0) {
    return `${quoteLead} 当日暂无相关新闻。`;
  }

  const topSources = Array.from(new Set(items.map((item) => item.source))).slice(0, 2).join("、");
  const topTitles = items
    .slice(0, 2)
    .map((item) => sanitizeTitle(item.title))
    .join("；");

  return sanitizeParagraph(`${quoteLead} 相关新闻主要来自${topSources}，焦点包括：${topTitles}。`);
}

function buildFallbackNewsOverview(
  allMarketNews: Array<{ symbol: string; title: string; source: string; publishedAt: Date }>
): string {
  if (allMarketNews.length === 0) {
    return "当日未抓取到可用的相关新闻，信息面整体偏中性。";
  }

  const sourceCounter = new Map<string, number>();
  const symbolOrder: string[] = [];
  const symbolSeen = new Set<string>();
  let positiveCount = 0;
  let negativeCount = 0;

  const positiveKeywords = ["beat", "upgrade", "outperform", "profit", "jump", "rise", "增长", "超预期", "盈利"];
  const negativeKeywords = [
    "drop",
    "fall",
    "downgrade",
    "concern",
    "risk",
    "investigation",
    "lawsuit",
    "weak",
    "下调",
    "下跌",
    "风险"
  ];

  for (const item of allMarketNews) {
    sourceCounter.set(item.source, (sourceCounter.get(item.source) ?? 0) + 1);
    if (!symbolSeen.has(item.symbol)) {
      symbolSeen.add(item.symbol);
      symbolOrder.push(item.symbol);
    }

    const lowerTitle = item.title.toLowerCase();
    if (positiveKeywords.some((keyword) => lowerTitle.includes(keyword))) {
      positiveCount += 1;
    }
    if (negativeKeywords.some((keyword) => lowerTitle.includes(keyword))) {
      negativeCount += 1;
    }
  }

  const topSources = [...sourceCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([source]) => source)
    .join("、");
  const coveredSymbols = symbolOrder.slice(0, 6).join("、");

  const tone =
    positiveCount > negativeCount ? "中性偏积极" : positiveCount < negativeCount ? "中性偏谨慎" : "中性";

  return sanitizeParagraph(
    `样本股共抓取${allMarketNews.length}条相关新闻，涉及${coveredSymbols}等公司，信息来源主要包括${topSources}。新闻主题集中在财报业绩、机构评级及监管动态等方向，从标题情绪看整体为${tone}。`
  );
}

function buildEnglishStockOverview(stocks: Stock[], quotes: Quote[]): string {
  if (quotes.length === 0) {
    return "Daily quote data is unavailable, so there is no reliable market-level read for this session.";
  }

  const advancers = quotes.filter((quote) => quote.changePct > 0).length;
  const decliners = quotes.filter((quote) => quote.changePct < 0).length;
  const averageChange = quotes.reduce((sum, quote) => sum + quote.changePct, 0) / quotes.length;
  const leader = [...quotes].sort((a, b) => b.changePct - a.changePct)[0];
  const laggard = [...quotes].sort((a, b) => a.changePct - b.changePct)[0];
  const breadth =
    advancers > decliners ? "breadth leaned positive" : advancers < decliners ? "breadth leaned negative" : "breadth was balanced";

  const mentions: string[] = [];
  if (leader) {
    const stock = stocks.find((item) => item.symbol === leader.symbol);
    mentions.push(`${stock?.displayName ?? leader.symbol} led with ${formatSignedPct(leader.changePct)}`);
  }
  if (laggard && laggard.symbol !== leader?.symbol) {
    const stock = stocks.find((item) => item.symbol === laggard.symbol);
    mentions.push(`${stock?.displayName ?? laggard.symbol} lagged at ${formatSignedPct(laggard.changePct)}`);
  }

  return sanitizeParagraph(
    `Across ${quotes.length} tracked names, the average move was ${formatSignedPct(averageChange)} and ${breadth} (${advancers} up, ${decliners} down). ${mentions.join(". ")}.`
  );
}

function buildEnglishStockNewsSummary(stock: Stock, quote: Quote | undefined, items: NewsItem[]): string {
  const quoteLead = quote
    ? `${stock.symbol} closed ${formatSignedPct(quote.changePct)} on the day.`
    : `${stock.symbol} did not have usable quote data for the session.`;

  if (items.length === 0) {
    return `${quoteLead} No relevant headlines were captured for this name.`;
  }

  const topSources = Array.from(new Set(items.map((item) => item.source)))
    .slice(0, 2)
    .join(", ");
  const topTitles = items
    .slice(0, 2)
    .map((item) => sanitizeTitle(item.title))
    .join("; ");

  return sanitizeParagraph(
    `${quoteLead} Coverage mainly came from ${topSources}, with the main talking points around ${topTitles}.`
  );
}

function buildEnglishNewsOverview(
  allMarketNews: Array<{ symbol: string; title: string; source: string; publishedAt: Date }>
): string {
  if (allMarketNews.length === 0) {
    return "No usable market-wide headlines were captured, leaving the information backdrop broadly neutral.";
  }

  const sourceCounter = new Map<string, number>();
  const symbolOrder: string[] = [];
  const symbolSeen = new Set<string>();
  let positiveCount = 0;
  let negativeCount = 0;

  const positiveKeywords = ["beat", "upgrade", "outperform", "profit", "jump", "rise", "growth", "strong"];
  const negativeKeywords = ["drop", "fall", "downgrade", "concern", "risk", "investigation", "lawsuit", "weak"];

  for (const item of allMarketNews) {
    sourceCounter.set(item.source, (sourceCounter.get(item.source) ?? 0) + 1);
    if (!symbolSeen.has(item.symbol)) {
      symbolSeen.add(item.symbol);
      symbolOrder.push(item.symbol);
    }

    const lowerTitle = item.title.toLowerCase();
    if (positiveKeywords.some((keyword) => lowerTitle.includes(keyword))) {
      positiveCount += 1;
    }
    if (negativeKeywords.some((keyword) => lowerTitle.includes(keyword))) {
      negativeCount += 1;
    }
  }

  const topSources = [...sourceCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([source]) => source)
    .join(", ");
  const coveredSymbols = symbolOrder.slice(0, 6).join(", ");
  const tone =
    positiveCount > negativeCount ? "slightly constructive" : positiveCount < negativeCount ? "slightly cautious" : "balanced";

  return sanitizeParagraph(
    `${allMarketNews.length} tracked headlines touched names such as ${coveredSymbols}, with sourcing led by ${topSources}. Themes clustered around earnings, broker views, and regulation, while headline tone looked ${tone}.`
  );
}

async function callAiCompatible(env: Env, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const baseUrl = env.OPENAI_BASE_URL ?? env.AI_GATEWAY_BASE_URL;
  if (!baseUrl) {
    return null;
  }

  const endpoint = resolveChatCompletionsEndpoint(baseUrl);
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  const apiKey = env.OPENAI_API_KEY ?? env.AI_API_KEY;
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: env.AI_MODEL ?? OPENAI_DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  return content && content.length > 0 ? content : null;
}

function resolveChatCompletionsEndpoint(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/+$/, "");
    if (path.endsWith("/chat/completions")) {
      return url.toString();
    }
    if (path === "" || path === "/") {
      url.pathname = "/v1/chat/completions";
      return url.toString();
    }
    if (path.endsWith("/v1")) {
      url.pathname = `${path}/chat/completions`;
      return url.toString();
    }
    url.pathname = `${path}/chat/completions`;
    return url.toString();
  } catch {
    return baseUrl;
  }
}

async function persistReportToD1(
  env: Env,
  input: {
    reportDateEt: string;
    quotes: Quote[];
    newsBySymbol: Map<string, NewsItem[]>;
    stockSummaryBySymbol: Map<string, LocalizedText>;
    marketOverviewZh: string;
    marketOverviewEn: string;
    requireDb: boolean;
  }
): Promise<void> {
  if (!env.DB) {
    if (input.requireDb) {
      throw new Error("DB binding is required for scheduled report persistence.");
    }
    return;
  }

  await ensureD1Schema(env.DB);
  const db = drizzle(env.DB);

  await db
    .insert(reportRuns)
    .values({
      reportDateEt: input.reportDateEt,
      marketOverview: input.marketOverviewZh,
      marketOverviewEn: input.marketOverviewEn
    })
    .onConflictDoUpdate({
      target: reportRuns.reportDateEt,
      set: {
        marketOverview: input.marketOverviewZh,
        marketOverviewEn: input.marketOverviewEn,
        createdAt: sql`CURRENT_TIMESTAMP`
      }
    });

  const run = await db
    .select({ id: reportRuns.id })
    .from(reportRuns)
    .where(eq(reportRuns.reportDateEt, input.reportDateEt))
    .limit(1);
  const runId = Number(run[0]?.id ?? 0);
  if (!runId) {
    return;
  }

  await db.delete(reportNews).where(eq(reportNews.runId, runId));
  await db.delete(reportQuotes).where(eq(reportQuotes.runId, runId));

  if (input.quotes.length > 0) {
    const quoteValues = input.quotes.map((quote) => ({
      runId,
      symbol: quote.symbol,
      name: quote.name,
      close: quote.close,
      previousClose: quote.previousClose,
      changePct: quote.changePct,
      volume: quote.volume,
      turnoverEstimate: quote.turnoverEstimate,
      currency: quote.currency
    }));
    const quoteBatchSize = 10;

    for (let index = 0; index < quoteValues.length; index += quoteBatchSize) {
      await db.insert(reportQuotes).values(quoteValues.slice(index, index + quoteBatchSize));
    }
  }

  const newsValues = Array.from(input.newsBySymbol.entries()).flatMap(([symbol, items]) => {
    const summary = input.stockSummaryBySymbol.get(symbol) ?? createLocalizedText(null, null);
    return items.map((item) => ({
      runId,
      symbol,
      title: item.title,
      link: item.link,
      source: item.source,
      publishedAt: item.publishedAt.toISOString(),
      aiSummary: summary.zh,
      aiSummaryEn: summary.en
    }));
  });

  if (newsValues.length > 0) {
    const newsBatchSize = 10;

    for (let index = 0; index < newsValues.length; index += newsBatchSize) {
      await db.insert(reportNews).values(newsValues.slice(index, index + newsBatchSize));
    }
  }
}

async function ensureD1Schema(db: D1Database): Promise<void> {
  await ensureReportTablesSchema(db);

  const statements = [
    "CREATE TABLE IF NOT EXISTS stocks (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, name TEXT NOT NULL, display_name TEXT NOT NULL, codes TEXT NOT NULL, business_type TEXT NOT NULL, aliases_json TEXT NOT NULL DEFAULT '[]', is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), deleted_at TEXT)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_symbol_unique ON stocks(symbol)",
    "CREATE INDEX IF NOT EXISTS idx_stocks_active_sort ON stocks(is_active, sort_order, id)"
  ];

  for (const statement of statements) {
    await db.prepare(statement).run();
  }

  await seedDefaultStocksIfEmpty(db);
}

async function ensureReportTablesSchema(db: D1Database): Promise<void> {
  const statements = [
    "CREATE TABLE IF NOT EXISTS report_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, report_date_et TEXT NOT NULL, market_overview TEXT, market_overview_en TEXT, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_report_runs_date_unique ON report_runs(report_date_et)",
    "CREATE INDEX IF NOT EXISTS idx_report_runs_date ON report_runs(report_date_et)",
    "CREATE TABLE IF NOT EXISTS report_quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, symbol TEXT NOT NULL, name TEXT NOT NULL, close REAL NOT NULL, previous_close REAL NOT NULL, change_pct REAL NOT NULL, volume INTEGER NOT NULL, turnover_estimate REAL NOT NULL, currency TEXT NOT NULL, FOREIGN KEY(run_id) REFERENCES report_runs(id))",
    "CREATE INDEX IF NOT EXISTS idx_report_quotes_symbol_run ON report_quotes(symbol, run_id)",
    "CREATE TABLE IF NOT EXISTS report_news (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, symbol TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL, source TEXT NOT NULL, published_at TEXT NOT NULL, ai_summary TEXT, ai_summary_en TEXT, FOREIGN KEY(run_id) REFERENCES report_runs(id))",
    "CREATE INDEX IF NOT EXISTS idx_report_news_run_symbol ON report_news(run_id, symbol)",
    "CREATE INDEX IF NOT EXISTS idx_report_news_symbol_run ON report_news(symbol, run_id)"
  ];

  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}

async function seedDefaultStocksIfEmpty(dbBinding: D1Database): Promise<void> {
  const existing = await dbBinding.prepare("SELECT COUNT(1) AS count FROM stocks").first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const db = drizzle(dbBinding);
  for (const [index, stock] of DEFAULT_STOCKS.entries()) {
    await db
      .insert(stocksTable)
      .values({
        symbol: stock.symbol,
        name: stock.name,
        displayName: stock.displayName,
        codes: stock.codes,
        businessType: stock.businessType,
        aliasesJson: JSON.stringify(stock.aliases),
        isActive: true,
        sortOrder: (index + 1) * 10
      })
      .onConflictDoUpdate({
        target: stocksTable.symbol,
        set: {
          name: stock.name,
          displayName: stock.displayName,
          codes: stock.codes,
          businessType: stock.businessType,
          aliasesJson: JSON.stringify(stock.aliases),
          isActive: true,
          sortOrder: (index + 1) * 10,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });
  }
}
