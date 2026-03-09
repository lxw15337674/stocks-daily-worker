import { swaggerUI } from "@hono/swagger-ui";
import { Readability } from "@mozilla/readability";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Feed } from "feed";
import { Hono } from "hono";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";
import { parseHTML } from "linkedom";
import { stocks as stocksTable } from "./db/schema";

interface Env {
  DB?: D1Database;
  REPORT_BUCKET?: R2Bucket;
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

type ReportSummary = {
  stockSummaryBySymbol: Map<string, string>;
  marketOverview: string;
};

type ReportListItem = {
  key: string;
  fileName: string;
  reportDateEt: string;
  createdAt: string;
  source: "d1" | "r2";
};

type RssFeedItem = {
  key: string;
  fileName: string;
  reportDateEt: string;
  createdAt: string;
  source: "d1" | "r2";
  marketOverview: string | null;
  markdown: string | null;
};

type StockAdminItem = {
  id: number;
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  aliases: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

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

type StockQuoteSnapshot = {
  close: number;
  previousClose: number;
  changePct: number;
  volume: number;
  turnoverEstimate: number;
  currency: string;
};

type StockHistoryPoint = StockQuoteSnapshot & {
  reportDateEt: string;
};

type StockNewsSummaryItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

type StockDetailPayload = {
  stock: StockAdminItem;
  latestReportDateEt: string | null;
  latestQuote: StockQuoteSnapshot | null;
  latestAiSummary: string | null;
  recentNews: StockNewsSummaryItem[];
  history: StockHistoryPoint[];
};

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
  "/run",
  describeRoute({
    tags: ["Reports"],
    summary: "Generate report now",
    description: "Generate the daily report immediately and return markdown.",
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
        description: "Generated markdown report",
        headers: {
          "x-report-file": {
            description: "Generated report file name",
            schema: { type: "string" }
          }
        },
        content: {
          "text/markdown": {
            schema: { type: "string" }
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

    const result = await generateAndPersistReport(c.env);
    return new Response(result.markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "x-report-file": result.fileName
      }
    });
  }
);

app.get(
  "/latest",
  describeRoute({
    tags: ["Reports"],
    summary: "Get latest archived report",
    description: "Reads from D1 first, then falls back to R2.",
    responses: {
      "200": {
        description: "Latest markdown report",
        content: {
          "text/markdown": {
            schema: { type: "string" }
          }
        }
      },
      "404": {
        description: "No archived report found",
        content: {
          "text/plain": {
            schema: { type: "string" }
          }
        }
      }
    }
  }),
  async (c) => {
    const latestFromDb = await getLatestReportFromD1(c.env);
    if (latestFromDb) {
      return new Response(latestFromDb.markdown, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "x-report-file": latestFromDb.fileName,
          "x-report-source": "d1"
        }
      });
    }

    if (!c.env.REPORT_BUCKET) {
      return c.text("No report found in D1 and REPORT_BUCKET is not configured.", 404);
    }

    const listing = await c.env.REPORT_BUCKET.list({ prefix: "reports/", limit: 1000 });
    const names = listing.objects.map((obj) => obj.key).sort((a, b) => b.localeCompare(a));
    const newest = names[0];
    if (!newest) {
      return c.text("No archived reports.", 404);
    }

    const object = await c.env.REPORT_BUCKET.get(newest);
    if (!object) {
      return c.text("Archived report missing.", 404);
    }

    return new Response(await object.text(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "x-report-file": newest,
        "x-report-source": "r2"
      }
    });
  }
);

app.get(
  "/reports",
  describeRoute({
    tags: ["Reports"],
    summary: "List archived reports",
    description: "Lists report history with pagination. Uses D1 first, then R2 when DB is unavailable.",
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
        description: "Pagination cursor. D1 uses id; R2 uses key."
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
                source: { type: "string", enum: ["d1", "r2"] },
                limit: { type: "integer" },
                cursor: { anyOf: [{ type: "string" }, { type: "null" }] },
                nextCursor: { anyOf: [{ type: "string" }, { type: "null" }] },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string" },
                      fileName: { type: "string" },
                      reportDateEt: { type: "string" },
                      createdAt: { type: "string" },
                      source: { type: "string", enum: ["d1", "r2"] }
                    },
                    required: ["key", "fileName", "reportDateEt", "createdAt", "source"]
                  }
                }
              },
              required: ["source", "limit", "nextCursor", "items"]
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

    const cursor = c.req.query("cursor")?.trim();

    if (c.env.DB) {
      let beforeId: number | null = null;
      if (cursor) {
        const parsed = Number(cursor);
        if (!Number.isInteger(parsed) || parsed < 1) {
          return c.text("Invalid cursor for D1 listing. Use positive integer id.", 400);
        }
        beforeId = parsed;
      }

      const list = await getReportListFromD1(c.env, limit, beforeId);
      return c.json({
        source: "d1",
        limit,
        cursor,
        nextCursor: list.nextCursor,
        items: list.items
      });
    }

    if (c.env.REPORT_BUCKET) {
      const list = await getReportListFromR2(c.env, limit, cursor);
      if (!list) {
        return c.text("Invalid cursor for R2 listing.", 400);
      }

      return c.json({
        source: "r2",
        limit,
        cursor,
        nextCursor: list.nextCursor,
        items: list.items
      });
    }

    return c.text("Neither DB nor REPORT_BUCKET is configured.", 400);
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
                latestAiSummary: { anyOf: [{ type: "string" }, { type: "null" }] },
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
                }
              },
              required: ["stock", "latestReportDateEt", "latestQuote", "latestAiSummary", "recentNews", "history"]
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
  "/report/:date",
  describeRoute({
    tags: ["Reports"],
    summary: "Get report by date",
    description:
      "Reads from D1 first, then R2. If missing and date is today (ET), generates on demand (requires admin token).",
    parameters: [
      {
        name: "date",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        description: "Date in YYYY-MM-DD format"
      },
      {
        name: "x-admin-token",
        in: "header",
        required: false,
        schema: { type: "string" },
        description: "Required only when triggering today's on-demand generation"
      }
    ],
    responses: {
      "200": {
        description: "Markdown report",
        content: {
          "text/markdown": {
            schema: { type: "string" }
          }
        }
      },
      "400": {
        description: "Invalid date format or missing REPORT_BUCKET for non-today date",
        content: {
          "text/plain": {
            schema: { type: "string" }
          }
        }
      },
      "404": {
        description: "Report not found",
        content: {
          "text/plain": {
            schema: { type: "string" }
          }
        }
      },
      "401": {
        description: "Missing or invalid admin token for today's on-demand generation"
      },
      "500": {
        description: "ADMIN_TOKEN is not configured on server"
      }
    }
  }),
  async (c) => {
    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.text("Invalid date format. Use YYYY-MM-DD.", 400);
    }

    const reportFromDb = await getReportByDateFromD1(c.env, date);
    if (reportFromDb) {
      return new Response(reportFromDb.markdown, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "x-report-file": reportFromDb.fileName,
          "x-report-source": "d1"
        }
      });
    }

    const key = `reports/china-stocks-daily-${date}.md`;
    if (c.env.REPORT_BUCKET) {
      const object = await c.env.REPORT_BUCKET.get(key);
      if (object) {
        return new Response(await object.text(), {
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "x-report-file": key,
            "x-report-source": "r2"
          }
        });
      }
    }

    const todayEt = formatDate(new Date(), ET_TIMEZONE);
    if (date === todayEt) {
      const authError = ensureAdminToken(c.req.header("x-admin-token"), c.env);
      if (authError) {
        return new Response(authError.message, { status: authError.status });
      }

      const result = await generateAndPersistReport(c.env);
      return new Response(result.markdown, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "x-report-file": `reports/${result.fileName}`
        }
      });
    }

    if (!c.env.REPORT_BUCKET) {
      return c.text("REPORT_BUCKET binding not configured. Can only generate today's report.", 400);
    }

    return c.text("Report not found.", 404);
  }
);

app.get(
  "/rss.xml",
  describeRoute({
    tags: ["Reports"],
    summary: "RSS feed for reports",
    description: "RSS 2.0 feed for latest reports. Uses D1 first, then R2 fallback.",
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 200, default: 30 },
        description: "Maximum number of feed items"
      }
    ],
    responses: {
      "200": {
        description: "RSS XML",
        content: {
          "application/rss+xml": {
            schema: { type: "string" }
          }
        }
      },
      "400": {
        description: "Invalid request parameters",
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

    const items = await getSyndicationItems(c.env, limit);

    const origin = new URL(c.req.url).origin;
    const xml = buildRssXml({ origin, items });

    return new Response(xml, {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  }
);

app.get(
  "/atom.xml",
  describeRoute({
    tags: ["Reports"],
    summary: "Atom feed for reports",
    description: "Atom 1.0 feed for latest reports. Uses D1 first, then R2 fallback.",
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 200, default: 30 },
        description: "Maximum number of feed items"
      }
    ],
    responses: {
      "200": {
        description: "Atom XML",
        content: {
          "application/atom+xml": {
            schema: { type: "string" }
          }
        }
      },
      "400": {
        description: "Invalid request parameters",
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

    const items = await getSyndicationItems(c.env, limit);
    const origin = new URL(c.req.url).origin;
    const xml = buildAtomXml({ origin, items });

    return new Response(xml, {
      headers: {
        "content-type": "application/atom+xml; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  }
);

app.get(
  "/feed.json",
  describeRoute({
    tags: ["Reports"],
    summary: "JSON Feed for reports",
    description: "JSON Feed 1.0 for latest reports. Uses D1 first, then R2 fallback.",
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 200, default: 30 },
        description: "Maximum number of feed items"
      }
    ],
    responses: {
      "200": {
        description: "JSON Feed",
        content: {
          "application/feed+json": {
            schema: { type: "string" }
          }
        }
      },
      "400": {
        description: "Invalid request parameters",
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

    const items = await getSyndicationItems(c.env, limit);
    const origin = new URL(c.req.url).origin;
    const json = buildJsonFeed({ origin, items });

    return new Response(json, {
      headers: {
        "content-type": "application/feed+json; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
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
        description: "Generate and fetch markdown reports for China ADR daily summary."
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
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await generateAndPersistReport(env, { requireDb: true });
  }
};

async function generateAndPersistReport(
  env: Env,
  options?: { requireDb?: boolean }
): Promise<{ markdown: string; fileName: string }> {
  const stocks = await getStockUniverse(env);
  const quotes = (await Promise.all(stocks.map((stock) => fetchQuote(stock)))).filter(
    (item): item is Quote => item !== null
  );

  const newsBySymbol = new Map<string, NewsItem[]>();
  await Promise.all(
    stocks.map(async (stock) => {
      const items = await fetchGoogleNews(env, stock);
      newsBySymbol.set(stock.symbol, items);
    })
  );

  const reportDateEt = formatDate(new Date(), ET_TIMEZONE);
  const generatedAtCn = formatDateTime(new Date(), CN_TIMEZONE);
  const aiSummary = await buildAiSummary(env, stocks, quotes, newsBySymbol);
  const markdown = buildMarkdown({
    reportDateEt,
    generatedAtCn,
    stocks,
    quotes,
    newsBySymbol,
    marketOverview: aiSummary.marketOverview
  });

  const fileName = `china-stocks-daily-${reportDateEt}.md`;

  if (env.REPORT_BUCKET) {
    await env.REPORT_BUCKET.put(`reports/${fileName}`, markdown, {
      httpMetadata: { contentType: "text/markdown; charset=utf-8" }
    });
  }

  await persistReportToD1(env, {
    reportDateEt,
    fileName,
    markdown,
    quotes,
    newsBySymbol,
    stockSummaryBySymbol: aiSummary.stockSummaryBySymbol,
    marketOverview: aiSummary.marketOverview,
    requireDb: options?.requireDb ?? false
  });

  if (env.WEBHOOK_URL) {
    await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName, markdown })
    });
  }

  return { markdown, fileName };
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
    "请根据输入股票名称生成最多3个候选股票信息，用于中概股股票池新增预览。",
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
    "你是中概股股票池维护助手。严格返回 JSON 对象，不允许额外文本。",
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
      latestAiSummary: null,
      recentNews: [],
      history: []
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

  const historyResult = await env.DB
    .prepare(
      `SELECT
        r.report_date_et AS reportDateEt,
        q.close AS close,
        q.previous_close AS previousClose,
        q.change_pct AS changePct,
        q.volume AS volume,
        q.turnover_estimate AS turnoverEstimate,
        q.currency AS currency
      FROM report_quotes q
      INNER JOIN report_runs r ON r.id = q.run_id
      WHERE q.symbol = ?
      ORDER BY r.report_date_et DESC, q.id DESC
      LIMIT 30`
    )
    .bind(symbol)
    .all<{
      reportDateEt: string;
      close: number;
      previousClose: number;
      changePct: number;
      volume: number;
      turnoverEstimate: number;
      currency: string;
    }>();

  const history = (historyResult.results ?? []).map((row) => ({
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

  const recentNewsResult = await env.DB
    .prepare(
      `SELECT
        n.title AS title,
        n.link AS link,
        n.source AS source,
        n.published_at AS publishedAt
      FROM report_news n
      INNER JOIN report_runs r ON r.id = n.run_id
      WHERE n.symbol = ?
      ORDER BY r.report_date_et DESC, n.published_at DESC, n.id DESC
      LIMIT 8`
    )
    .bind(symbol)
    .all<StockNewsSummaryItem>();

  const latestSummaryRow = await env.DB
    .prepare(
      `SELECT
        n.ai_summary AS aiSummary
      FROM report_news n
      INNER JOIN report_runs r ON r.id = n.run_id
      WHERE n.symbol = ? AND n.ai_summary IS NOT NULL AND TRIM(n.ai_summary) <> ''
      ORDER BY r.report_date_et DESC, n.id DESC
      LIMIT 1`
    )
    .bind(symbol)
    .first<{ aiSummary: string | null }>();

  return {
    stock,
    latestReportDateEt,
    latestQuote,
    latestAiSummary: latestSummaryRow?.aiSummary?.trim() || null,
    recentNews: recentNewsResult.results ?? [],
    history
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

async function fetchGoogleNews(env: Env, stock: Stock): Promise<NewsItem[]> {
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

    const config = getNewsBodyFetchConfig(env);
    if (!config.enabled || config.perStockLimit <= 0 || deduped.length === 0) {
      return deduped;
    }

    return Promise.all(
      deduped.map(async (item, index) => {
        if (index >= config.perStockLimit) {
          return item;
        }

        const bodySnippet = await fetchNewsBodySnippet(item.link, {
          timeoutMs: config.timeoutMs,
          maxChars: config.maxChars
        });
        return bodySnippet ? { ...item, bodySnippet } : item;
      })
    );
  } catch {
    return [];
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

async function fetchNewsBodySnippet(
  url: string,
  options: { timeoutMs: number; maxChars: number }
): Promise<string | null> {
  let timeoutHandle: number | undefined;
  const controller = new AbortController();

  try {
    timeoutHandle = setTimeout(() => controller.abort(), options.timeoutMs) as unknown as number;
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    const html = await response.text();
    return extractNewsBodySnippetFromHtml(html, options.maxChars, url);
  } catch {
    return null;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
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

function buildMarkdown(params: {
  reportDateEt: string;
  generatedAtCn: string;
  stocks: Stock[];
  quotes: Quote[];
  newsBySymbol: Map<string, NewsItem[]>;
  marketOverview: string;
}): string {
  const { reportDateEt, generatedAtCn, stocks, quotes, newsBySymbol, marketOverview } = params;
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const aiOverview = splitAiOverviewParagraphs(marketOverview);

  const lines: string[] = [];
  lines.push(`# 中概日报 | ${reportDateEt}（美东交易日）`);
  lines.push("");
  lines.push(`> 生成时间：${generatedAtCn}（北京时间）`);
  lines.push(`> 样本范围：中概股（N=${stocks.length}）`);
  lines.push(`> 有效行情：${quotes.length} 只`);
  lines.push("");
  lines.push("## 一、AI总览");
  lines.push(`股票市场：${aiOverview.stockParagraph}`);
  lines.push("");
  lines.push(`相关新闻：${aiOverview.newsParagraph}`);
  lines.push("");
  lines.push("## 二、股票数据");
  lines.push("| 公司名称 | 涨跌幅 | 收盘价 |\n|---|---:|---:|");
  for (const stock of stocks) {
    const quote = quoteBySymbol.get(stock.symbol);
    lines.push(
      `| ${stock.displayName} | ${
        quote ? formatSignedPct(quote.changePct) : "-"
      } | ${quote ? formatPrice(quote.close, quote.currency) : "-"} |`
    );
  }

  lines.push("");
  lines.push("## 三、相关新闻（按公司）");

  for (const stock of stocks) {
    const quote = quoteBySymbol.get(stock.symbol);
    const changeLabel = quote ? formatSignedPct(quote.changePct) : "行情暂无";
    lines.push(`### ${stock.symbol}（${stock.displayName}） ${changeLabel}`);

    const items = newsBySymbol.get(stock.symbol) ?? [];
    if (items.length === 0) {
      lines.push("- 暂无相关新闻");
      lines.push("");
      continue;
    }

    for (const item of items) {
      lines.push(
        `- [${sanitizeTitle(item.title)}](${item.link})（来源：${item.source}，时间：${formatDateTime(item.publishedAt, ET_TIMEZONE)} ET）`
      );
    }
    lines.push("");
  }

  lines.push("## 四、数据来源与免责声明");
  lines.push("- 行情：Yahoo Finance 免费公开接口");
  lines.push("- 新闻：Google News RSS 公开源");
  lines.push("- 免责声明：本报告仅做公开信息整理，不构成任何投资建议。\n");

  return lines.join("\n");
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

function splitAiOverviewParagraphs(
  marketOverview: string,
  fallback?: { stockParagraph: string; newsParagraph: string }
): { stockParagraph: string; newsParagraph: string } {
  const normalized = marketOverview.replace(/\r\n/g, "\n").trim();
  const defaultStock =
    fallback?.stockParagraph ?? "当日股票行情已更新，市场表现请结合下方个股涨跌和成交数据综合判断。";
  const defaultNews =
    fallback?.newsParagraph ?? "相关新闻主要围绕样本股公司动态展开，详见下方“相关新闻”板块。";

  if (!normalized) {
    return { stockParagraph: defaultStock, newsParagraph: defaultNews };
  }

  const stockMatch = normalized.match(
    /(?:^|\n)\s*(?:第一段|股票市场|市场概览|市场总览)\s*[：:]\s*([\s\S]*?)(?=\n\s*(?:第二段|相关新闻|新闻概览|新闻总览)\s*[：:]|$)/i
  );
  const newsMatch = normalized.match(/(?:^|\n)\s*(?:第二段|相关新闻|新闻概览|新闻总览)\s*[：:]\s*([\s\S]*?)$/i);

  if (stockMatch || newsMatch) {
    const stockParagraph = sanitizeParagraph(stockMatch?.[1] ?? defaultStock) || defaultStock;
    const newsParagraph = sanitizeParagraph(newsMatch?.[1] ?? defaultNews) || defaultNews;
    return {
      stockParagraph,
      newsParagraph
    };
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => sanitizeParagraph(paragraph))
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length >= 2) {
    return {
      stockParagraph: paragraphs[0],
      newsParagraph: paragraphs.slice(1).join(" ")
    };
  }

  return {
    stockParagraph: sanitizeParagraph(normalized) || defaultStock,
    newsParagraph: defaultNews
  };
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

async function getLatestReportFromD1(env: Env): Promise<{ markdown: string; fileName: string } | null> {
  if (!env.DB) {
    return null;
  }

  await ensureD1Schema(env.DB);
  const row = await env.DB.prepare(
    "SELECT markdown, file_name AS fileName FROM report_runs ORDER BY report_date_et DESC, id DESC LIMIT 1"
  ).first<{ markdown: string; fileName: string }>();
  return row ?? null;
}

async function getReportByDateFromD1(
  env: Env,
  reportDateEt: string
): Promise<{ markdown: string; fileName: string } | null> {
  if (!env.DB) {
    return null;
  }

  await ensureD1Schema(env.DB);
  const row = await env.DB.prepare(
    "SELECT markdown, file_name AS fileName FROM report_runs WHERE report_date_et = ? ORDER BY id DESC LIMIT 1"
  )
    .bind(reportDateEt)
    .first<{ markdown: string; fileName: string }>();
  return row ?? null;
}

async function getReportListFromD1(
  env: Env,
  limit: number,
  beforeId: number | null
): Promise<{ items: ReportListItem[]; nextCursor: string | null }> {
  if (!env.DB) {
    return { items: [], nextCursor: null };
  }

  await ensureD1Schema(env.DB);
  const pageSize = limit + 1;
  const result = beforeId
    ? await env.DB
        .prepare(
          "SELECT id, report_date_et AS reportDateEt, file_name AS fileName, created_at AS createdAt FROM report_runs WHERE id < ? ORDER BY id DESC LIMIT ?"
        )
        .bind(beforeId, pageSize)
        .all<{ id: number; reportDateEt: string; fileName: string; createdAt: string }>()
    : await env.DB
        .prepare(
          "SELECT id, report_date_et AS reportDateEt, file_name AS fileName, created_at AS createdAt FROM report_runs ORDER BY id DESC LIMIT ?"
        )
        .bind(pageSize)
        .all<{ id: number; reportDateEt: string; fileName: string; createdAt: string }>();

  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const items = visibleRows.map((row) => ({
    key: `reports/${row.fileName}`,
    fileName: row.fileName,
    reportDateEt: row.reportDateEt,
    createdAt: row.createdAt,
    source: "d1" as const
  }));
  const nextCursor = hasMore && visibleRows.length > 0 ? String(visibleRows[visibleRows.length - 1].id) : null;

  return { items, nextCursor };
}

async function getReportListFromR2(
  env: Env,
  limit: number,
  cursor?: string
): Promise<{ items: ReportListItem[]; nextCursor: string | null } | null> {
  if (!env.REPORT_BUCKET) {
    return { items: [], nextCursor: null };
  }

  const initialYear = cursor ? extractYearFromReportKey(cursor) : getCurrentReportYearEt();
  if (!initialYear) {
    return null;
  }

  const pageSize = limit + 1;
  const collected: Array<{ key: string; uploaded: Date }> = [];
  let cursorResolved = !cursor;

  outer: for (let year = initialYear; year >= 2000; year -= 1) {
    const yearObjects = await listR2ReportObjectsByYear(env, year);
    if (yearObjects.length === 0) {
      continue;
    }

    let startIndex = 0;
    if (cursor && !cursorResolved) {
      const cursorIndex = yearObjects.findIndex((obj) => obj.key === cursor);
      if (cursorIndex < 0) {
        return null;
      }
      startIndex = cursorIndex + 1;
      cursorResolved = true;
    }

    for (let index = startIndex; index < yearObjects.length; index += 1) {
      collected.push(yearObjects[index]);
      if (collected.length >= pageSize) {
        break outer;
      }
    }
  }

  if (!cursorResolved) {
    return null;
  }

  const hasMore = collected.length > limit;
  const visible = hasMore ? collected.slice(0, limit) : collected;
  const nextCursor = hasMore && visible.length > 0 ? visible[visible.length - 1].key : null;

  const items = visible.map((obj) => ({
    key: obj.key,
    fileName: obj.key.replace(/^reports\//, ""),
    reportDateEt: extractDateFromReportKey(obj.key),
    createdAt: obj.uploaded.toISOString(),
    source: "r2" as const
  }));

  return { items, nextCursor };
}

async function listR2ReportObjectsByYear(
  env: Env,
  year: number
): Promise<Array<{ key: string; uploaded: Date }>> {
  if (!env.REPORT_BUCKET) {
    return [];
  }

  const prefix = `reports/china-stocks-daily-${year}-`;
  const objects: Array<{ key: string; uploaded: Date }> = [];
  let cursor: string | undefined;

  do {
    const listing = await env.REPORT_BUCKET.list({ prefix, limit: 1000, cursor });
    for (const object of listing.objects) {
      if (extractYearFromReportKey(object.key) === year) {
        objects.push({ key: object.key, uploaded: object.uploaded });
      }
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  objects.sort((a, b) => b.key.localeCompare(a.key));
  return objects;
}

async function getRssFeedItemsFromD1(env: Env, limit: number): Promise<RssFeedItem[]> {
  if (!env.DB) {
    return [];
  }

  await ensureD1Schema(env.DB);
  const result = await env.DB
    .prepare(
      "SELECT report_date_et AS reportDateEt, file_name AS fileName, created_at AS createdAt, market_overview AS marketOverview, markdown FROM report_runs ORDER BY id DESC LIMIT ?"
    )
    .bind(limit)
    .all<{
      reportDateEt: string;
      fileName: string;
      createdAt: string;
      marketOverview: string | null;
      markdown: string;
    }>();

  const rows = result.results ?? [];
  return rows.map((row) => ({
    key: `reports/${row.fileName}`,
    fileName: row.fileName,
    reportDateEt: row.reportDateEt,
    createdAt: row.createdAt,
    source: "d1" as const,
    marketOverview: row.marketOverview ?? null,
    markdown: row.markdown
  }));
}

async function getRssFeedItemsFromR2(env: Env, limit: number): Promise<RssFeedItem[]> {
  if (!env.REPORT_BUCKET) {
    return [];
  }

  const list = await getReportListFromR2(env, limit);
  if (!list) {
    return [];
  }

  const items = await Promise.all(
    list.items.map(async (item) => {
      const object = await env.REPORT_BUCKET?.get(item.key);
      const markdown = object ? await object.text() : null;

      return {
        ...item,
        marketOverview: null,
        markdown
      };
    })
  );

  return items;
}

async function getSyndicationItems(env: Env, limit: number): Promise<RssFeedItem[]> {
  let items: RssFeedItem[] = [];
  if (env.DB) {
    items = await getRssFeedItemsFromD1(env, limit);
  }
  if (items.length === 0 && env.REPORT_BUCKET) {
    items = await getRssFeedItemsFromR2(env, limit);
  }
  return items;
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

function extractDateFromReportKey(key: string): string {
  const matched = key.match(/(\d{4}-\d{2}-\d{2})/);
  return matched?.[1] ?? "";
}

function extractYearFromReportKey(key: string): number | null {
  const date = extractDateFromReportKey(key);
  if (!date) {
    return null;
  }
  const parsed = Number(date.slice(0, 4));
  if (!Number.isInteger(parsed) || parsed < 2000) {
    return null;
  }
  return parsed;
}

function getCurrentReportYearEt(): number {
  const reportDateEt = formatDate(new Date(), ET_TIMEZONE);
  const parsed = Number(reportDateEt.slice(0, 4));
  if (Number.isInteger(parsed) && parsed >= 2000) {
    return parsed;
  }
  return new Date().getUTCFullYear();
}

function buildRssXml(params: { origin: string; items: RssFeedItem[] }): string {
  return createSyndicationFeed(params).rss2();
}

function buildAtomXml(params: { origin: string; items: RssFeedItem[] }): string {
  return createSyndicationFeed(params).atom1();
}

function buildJsonFeed(params: { origin: string; items: RssFeedItem[] }): string {
  return createSyndicationFeed(params).json1();
}

function createSyndicationFeed(params: { origin: string; items: RssFeedItem[] }): Feed {
  const { origin, items } = params;
  const channelLink = `${origin}/`;
  const rssLink = `${origin}/rss.xml`;
  const atomLink = `${origin}/atom.xml`;
  const jsonLink = `${origin}/feed.json`;
  const mostRecent = items[0];
  const updated = mostRecent ? toRssDate(mostRecent.createdAt, mostRecent.reportDateEt) : new Date();

  const feed = new Feed({
    id: channelLink,
    link: channelLink,
    title: "中概日报 RSS",
    description: "中概日报每日更新，覆盖中概股行情与新闻摘要。",
    language: "zh-CN",
    updated,
    feedLinks: {
      rss: rssLink,
      atom: atomLink,
      json: jsonLink
    },
    generator: "china-stocks-daily-worker"
  });

  for (const item of items) {
    const itemLink = `${origin}/report/${item.reportDateEt}`;
    const fullContent = buildFeedFullContent(item);
    feed.addItem({
      id: `${origin}/${item.key}`,
      link: itemLink,
      title: `中概日报 | ${item.reportDateEt}（美东交易日）`,
      description: fullContent,
      content: markdownToHtmlPre(fullContent),
      date: toRssDate(item.createdAt, item.reportDateEt)
    });
  }

  return feed;
}

function buildFeedFullContent(item: RssFeedItem): string {
  const markdown = item.markdown?.trim();
  if (markdown) {
    return markdown;
  }

  if (item.marketOverview) {
    return sanitizeTitle(item.marketOverview);
  }

  return `${item.reportDateEt} 报告已生成，点击查看完整 Markdown 内容。`;
}

function markdownToHtmlPre(markdown: string): string {
  return `<pre>${escapeHtml(markdown)}</pre>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toRssDate(createdAt: string, fallbackDate: string): Date {
  const parsed = parseCreatedAt(createdAt);
  if (parsed) {
    return parsed;
  }

  const fallback = new Date(`${fallbackDate}T00:00:00Z`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }
  return new Date();
}

function parseCreatedAt(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withTimezone = /(?:[zZ]|[+\-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withTimezone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function buildAiSummary(
  env: Env,
  stocks: Stock[],
  quotes: Quote[],
  newsBySymbol: Map<string, NewsItem[]>
): Promise<ReportSummary> {
  const stockSummaryBySymbol = new Map<string, string>();
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

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

  const allMarketNews = stocks
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

  const allMarketNewsLines = allMarketNews
    .map((item, index) => {
      const snippet = item.bodySnippet ? `；正文摘要：${sanitizeParagraph(item.bodySnippet)}` : "";
      return `${index + 1}. [${item.symbol}] ${item.title} (${item.source}, ${formatDateTime(item.publishedAt, ET_TIMEZONE)} ET)${snippet}`;
    })
    .join("\n");

  const fallbackStockParagraph = await buildFallbackStockOverview(env, stocks, quoteBySymbol, quotes);
  const fallbackNewsParagraph = buildFallbackNewsOverview(allMarketNews);

  const marketPrompt = [
    "请基于以下中概股的股票数据和相关新闻，输出中文 AI 总览，严格分成两段。",
    "要求：第一段只讲股票市场，控制在50字以内，必须概括整体盘面，并至少包含以下信息中的两项：整体涨跌方向、代表性强弱个股、上涨或下跌覆盖面。不要重复原始数据列表，不要空泛表述。",
    "要求：第二段只讲相关新闻，控制在180字以内，只提炼高相关、重复出现或影响较大的主线信息。优先总结财报、监管、评级、业务进展、行业政策等主题，忽略纯持仓披露、零散技术分析、重复改写标题和低价值噪音。",
    "如果新闻不足以形成主线，请明确写信息面未形成明显主线，整体偏中性。",
    "只基于给定信息，不要猜测原因，不要把单一公司新闻上升为整个板块结论。",
    "请严格使用如下格式：",
    "股票市场：<第一段内容>",
    "相关新闻：<第二段内容>",
    `股票数据:\n${quoteLines}`,
    allMarketNewsLines ? `相关新闻:\n${allMarketNewsLines}` : "相关新闻: 无"
  ].join("\n\n");

  const aiOverviewRaw = await callAiCompatible(
    env,
    "你是中概日报编辑。你只能基于用户提供的股票数据和新闻做归纳，不得补充外部事实、背景或猜测。请严格输出两行中文内容，格式固定为：股票市场：<内容>；相关新闻：<内容>。不要输出任何额外前言、解释、项目符号或第三段内容。语言客观克制，不写投资建议，不使用“有望、值得关注、或将、看好”等评论性表述。",
    marketPrompt
  );

  const parsedOverview = splitAiOverviewParagraphs(aiOverviewRaw ?? "", {
    stockParagraph: fallbackStockParagraph,
    newsParagraph: fallbackNewsParagraph
  });
  const marketOverview = `股票市场：${parsedOverview.stockParagraph}\n\n相关新闻：${parsedOverview.newsParagraph}`;

  const stockSummaryPairs = await Promise.all(
    stocks.map(async (stock) => {
      const summary = await buildStockNewsSummary(
        env,
        stock,
        quoteBySymbol.get(stock.symbol),
        newsBySymbol.get(stock.symbol) ?? []
      );
      return [stock.symbol, summary] as const;
    })
  );
  for (const [symbol, summary] of stockSummaryPairs) {
    stockSummaryBySymbol.set(symbol, summary);
  }

  return { stockSummaryBySymbol, marketOverview };
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
    "请基于以下中概股行情，生成一段中文股票市场概览。",
    "要求：只讲股票市场，不提新闻；语气客观；不要投资建议；不要项目符号；50字以内。",
    `行情数据:\n${quoteLines}`
  ].join("\n\n");

  const aiRaw = await callAiCompatible(
    env,
    "你是中概股日报编辑。仅输出一段中文股票市场概览，不要附加标题。",
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
      "你是中概股个股新闻编辑。仅输出一段简洁中文摘要正文，不要附加标题或项目符号。",
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
    fileName: string;
    markdown: string;
    quotes: Quote[];
    newsBySymbol: Map<string, NewsItem[]>;
    stockSummaryBySymbol: Map<string, string>;
    marketOverview: string;
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

  await env.DB.prepare(
    "INSERT INTO report_runs (report_date_et, file_name, markdown, market_overview) VALUES (?, ?, ?, ?) ON CONFLICT(report_date_et) DO UPDATE SET file_name = excluded.file_name, markdown = excluded.markdown, market_overview = excluded.market_overview, created_at = CURRENT_TIMESTAMP"
  )
    .bind(input.reportDateEt, input.fileName, input.markdown, input.marketOverview)
    .run();

  const run = await env.DB.prepare("SELECT id FROM report_runs WHERE report_date_et = ? LIMIT 1")
    .bind(input.reportDateEt)
    .first<{ id: number }>();
  const runId = Number(run?.id ?? 0);
  if (!runId) {
    return;
  }

  await env.DB.prepare("DELETE FROM report_news WHERE run_id = ?").bind(runId).run();
  await env.DB.prepare("DELETE FROM report_quotes WHERE run_id = ?").bind(runId).run();

  for (const quote of input.quotes) {
    await env.DB.prepare(
      "INSERT INTO report_quotes (run_id, symbol, name, close, previous_close, change_pct, volume, turnover_estimate, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        runId,
        quote.symbol,
        quote.name,
        quote.close,
        quote.previousClose,
        quote.changePct,
        quote.volume,
        quote.turnoverEstimate,
        quote.currency
      )
      .run();
  }

  for (const [symbol, items] of input.newsBySymbol.entries()) {
    const summary = input.stockSummaryBySymbol.get(symbol) ?? null;
    for (const item of items) {
      await env.DB.prepare(
        "INSERT INTO report_news (run_id, symbol, title, link, source, published_at, ai_summary) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(runId, symbol, item.title, item.link, item.source, item.publishedAt.toISOString(), summary)
        .run();
    }
  }
}

async function ensureD1Schema(db: D1Database): Promise<void> {
  const statements = [
    "CREATE TABLE IF NOT EXISTS report_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, report_date_et TEXT NOT NULL, file_name TEXT NOT NULL, markdown TEXT NOT NULL, market_overview TEXT, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))",
    "CREATE TABLE IF NOT EXISTS report_quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, symbol TEXT NOT NULL, name TEXT NOT NULL, close REAL NOT NULL, previous_close REAL NOT NULL, change_pct REAL NOT NULL, volume INTEGER NOT NULL, turnover_estimate REAL NOT NULL, currency TEXT NOT NULL, FOREIGN KEY(run_id) REFERENCES report_runs(id))",
    "CREATE TABLE IF NOT EXISTS report_news (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, symbol TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL, source TEXT NOT NULL, published_at TEXT NOT NULL, ai_summary TEXT, FOREIGN KEY(run_id) REFERENCES report_runs(id))",
    "CREATE TABLE IF NOT EXISTS stocks (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, name TEXT NOT NULL, display_name TEXT NOT NULL, codes TEXT NOT NULL, business_type TEXT NOT NULL, aliases_json TEXT NOT NULL DEFAULT '[]', is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), deleted_at TEXT)",
    "CREATE INDEX IF NOT EXISTS idx_report_runs_date ON report_runs(report_date_et)",
    "CREATE INDEX IF NOT EXISTS idx_report_news_run_symbol ON report_news(run_id, symbol)",
    "CREATE INDEX IF NOT EXISTS idx_stocks_active_sort ON stocks(is_active, sort_order, id)"
  ];

  for (const sql of statements) {
    await db.prepare(sql).run();
  }

  await deduplicateReportRunsByDate(db);
  await db
    .prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_report_runs_date_unique ON report_runs(report_date_et)")
    .run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_symbol_unique ON stocks(symbol)").run();
  await seedDefaultStocksIfEmpty(db);
}

async function deduplicateReportRunsByDate(db: D1Database): Promise<void> {
  const duplicateDateResult = await db
    .prepare("SELECT report_date_et AS reportDateEt FROM report_runs GROUP BY report_date_et HAVING COUNT(*) > 1")
    .all<{ reportDateEt: string }>();
  const duplicateDates = duplicateDateResult.results ?? [];

  for (const duplicateDate of duplicateDates) {
    const runsResult = await db
      .prepare("SELECT id FROM report_runs WHERE report_date_et = ? ORDER BY id DESC")
      .bind(duplicateDate.reportDateEt)
      .all<{ id: number }>();
    const runs = runsResult.results ?? [];

    if (runs.length <= 1) {
      continue;
    }

    const staleRuns = runs.slice(1);
    for (const staleRun of staleRuns) {
      await db.prepare("DELETE FROM report_news WHERE run_id = ?").bind(staleRun.id).run();
      await db.prepare("DELETE FROM report_quotes WHERE run_id = ?").bind(staleRun.id).run();
      await db.prepare("DELETE FROM report_runs WHERE id = ?").bind(staleRun.id).run();
    }
  }
}

async function seedDefaultStocksIfEmpty(dbBinding: D1Database): Promise<void> {
  const existing = await dbBinding.prepare("SELECT COUNT(1) AS count FROM stocks").first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const db = drizzle(dbBinding);
  const values = DEFAULT_STOCKS.map((stock, index) => ({
    symbol: stock.symbol,
    name: stock.name,
    displayName: stock.displayName,
    codes: stock.codes,
    businessType: stock.businessType,
    aliasesJson: JSON.stringify(stock.aliases),
    isActive: true,
    sortOrder: (index + 1) * 10
  }));

  if (values.length > 0) {
    await db.insert(stocksTable).values(values);
  }
}
