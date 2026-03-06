import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";

interface Env {
  DB?: D1Database;
  REPORT_BUCKET?: R2Bucket;
  STOCK_LIST_JSON?: string;
  WEBHOOK_URL?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  AI_MODEL?: string;
  // Backward-compatible aliases.
  AI_GATEWAY_BASE_URL?: string;
  AI_API_KEY?: string;
}

type Stock = {
  symbol: string;
  name: string;
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

// KWEB top-10 holdings (KraneShares, data as of 2026-03-04).
const KWEB_TOP10_STOCKS: Stock[] = [
  { symbol: "0700.HK", name: "Tencent Holdings", aliases: ["腾讯"] },
  { symbol: "9988.HK", name: "Alibaba Group", aliases: ["阿里巴巴", "阿里"] },
  { symbol: "PDD", name: "PDD Holdings", aliases: ["拼多多"] },
  { symbol: "3690.HK", name: "Meituan", aliases: ["美团"] },
  { symbol: "9999.HK", name: "NetEase", aliases: ["网易"] },
  { symbol: "2423.HK", name: "KE Holdings", aliases: ["贝壳"] },
  { symbol: "9888.HK", name: "Baidu", aliases: ["百度"] },
  { symbol: "1024.HK", name: "Kuaishou", aliases: ["快手"] },
  { symbol: "6618.HK", name: "JD Health", aliases: ["京东健康"] },
  { symbol: "9618.HK", name: "JD.com", aliases: ["京东"] }
];

const ET_TIMEZONE = "America/New_York";
const CN_TIMEZONE = "Asia/Shanghai";
const OPENAPI_VERSION = "3.1.0";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

const app = new Hono<{ Bindings: Env }>();

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
      }
    }
  }),
  async (c) => {
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
  "/report/:date",
  describeRoute({
    tags: ["Reports"],
    summary: "Get report by date",
    description: "Reads from D1 first, then R2. If missing and date is today (ET), generates on demand.",
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
    await generateAndPersistReport(env);
  }
};

async function generateAndPersistReport(env: Env): Promise<{ markdown: string; fileName: string }> {
  const stocks = getStockUniverse(env);
  const quotes = (await Promise.all(stocks.map((stock) => fetchQuote(stock)))).filter(
    (item): item is Quote => item !== null
  );

  const newsBySymbol = new Map<string, NewsItem[]>();
  await Promise.all(
    stocks.map(async (stock) => {
      const items = await fetchGoogleNews(stock);
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
    marketOverview: aiSummary.marketOverview
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

function getStockUniverse(env: Env): Stock[] {
  const kwebMap = new Map(KWEB_TOP10_STOCKS.map((stock) => [stock.symbol, stock]));

  if (!env.STOCK_LIST_JSON) {
    return KWEB_TOP10_STOCKS;
  }

  try {
    const parsed = JSON.parse(env.STOCK_LIST_JSON) as Stock[];
    const customMap = new Map<string, Stock>();

    for (const stock of parsed) {
      if (!stock?.symbol || !stock?.name || !Array.isArray(stock.aliases)) {
        continue;
      }
      if (!kwebMap.has(stock.symbol)) {
        continue;
      }
      customMap.set(stock.symbol, {
        symbol: stock.symbol,
        name: stock.name,
        aliases: stock.aliases
      });
    }

    return KWEB_TOP10_STOCKS.map((stock) => customMap.get(stock.symbol) ?? stock);
  } catch {
    return KWEB_TOP10_STOCKS;
  }
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

async function fetchGoogleNews(stock: Stock): Promise<NewsItem[]> {
  try {
    const q = `${stock.symbol} ${stock.name} stock`;
    const endpoint = `https://news.google.com/rss/search?q=${encodeURIComponent(
      q
    )}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const items = parseRss(xml)
      .filter((item) => isRelevantNews(item.title, stock))
      .slice(0, 5)
      .map((item) => ({ ...item, symbol: stock.symbol }));

    return dedupeNews(items).slice(0, 3);
  } catch {
    return [];
  }
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
  const aliases = [stock.symbol, stock.name, ...stock.aliases].map((entry) => entry.toLowerCase());

  return aliases.some((alias) => alias.length > 1 && normalized.includes(alias));
}

function extractTag(input: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = input.match(regex);
  return match?.[1]?.trim() ?? "";
}

function htmlDecode(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
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

  const lines: string[] = [];
  lines.push(`# 中概日报 | ${reportDateEt}（美东交易日）`);
  lines.push("");
  lines.push(`> 生成时间：${generatedAtCn}（北京时间）`);
  lines.push(`> 样本范围：KWEB前10成分股（N=${stocks.length}）`);
  lines.push(`> 有效行情：${quotes.length} 只`);
  lines.push("");
  lines.push("## 一、AI总览");
  lines.push(`> ${sanitizeTitle(marketOverview)}`);
  lines.push("");
  lines.push("## 二、股票数据");
  lines.push("| 代码 | 名称 | 收盘价 | 涨跌幅 | 成交量 | 估算成交额 |\n|---|---|---:|---:|---:|---:|");
  for (const stock of stocks) {
    const quote = quoteBySymbol.get(stock.symbol);
    lines.push(
      `| ${stock.symbol} | ${stock.name} | ${
        quote ? formatPrice(quote.close, quote.currency) : "-"
      } | ${quote ? formatSignedPct(quote.changePct) : "-"} | ${
        quote ? quote.volume.toLocaleString("en-US") : "-"
      } | ${quote ? formatMoney(quote.turnoverEstimate, quote.currency) : "-"} |`
    );
  }

  lines.push("");
  lines.push("## 三、相关新闻（按公司）");

  for (const stock of stocks) {
    const quote = quoteBySymbol.get(stock.symbol);
    const changeLabel = quote ? formatSignedPct(quote.changePct) : "行情暂无";
    lines.push(`### ${stock.symbol}（${stock.name}） ${changeLabel}`);

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

function truncateByChars(input: string, maxChars: number): string {
  const normalized = input.trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) {
    return normalized;
  }
  return `${chars.slice(0, maxChars).join("")}...`;
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

  const listing = await env.REPORT_BUCKET.list({ prefix: "reports/", limit: 1000 });
  const objects = [...listing.objects].sort((a, b) => b.key.localeCompare(a.key));

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = objects.findIndex((obj) => obj.key === cursor);
    if (cursorIndex < 0) {
      return null;
    }
    startIndex = cursorIndex + 1;
  }

  const page = objects.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < objects.length && page.length > 0 ? page[page.length - 1].key : null;

  const items = page.map((obj) => ({
    key: obj.key,
    fileName: obj.key.replace(/^reports\//, ""),
    reportDateEt: extractDateFromReportKey(obj.key),
    createdAt: obj.uploaded.toISOString(),
    source: "r2" as const
  }));

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

function extractDateFromReportKey(key: string): string {
  const matched = key.match(/(\d{4}-\d{2}-\d{2})/);
  return matched?.[1] ?? "";
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
        ? `- ${stock.symbol} (${stock.name}): 收盘${formatPrice(quote.close, quote.currency)}, 涨跌幅${formatSignedPct(
            quote.changePct
          )}, 成交量${quote.volume.toLocaleString("en-US")}, 估算成交额${formatMoney(
            quote.turnoverEstimate,
            quote.currency
          )}`
        : `- ${stock.symbol} (${stock.name}): 行情数据缺失`;
    })
    .join("\n");

  const allMarketNews = stocks
    .flatMap((stock) => {
      const items = newsBySymbol.get(stock.symbol) ?? [];
      return items.map((item) => ({
        symbol: stock.symbol,
        title: sanitizeTitle(item.title),
        source: item.source,
        publishedAt: item.publishedAt
      }));
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const allMarketNewsLines = allMarketNews
    .map(
      (item, index) =>
        `${index + 1}. [${item.symbol}] ${item.title} (${item.source}, ${formatDateTime(item.publishedAt, ET_TIMEZONE)} ET)`
    )
    .join("\n");

  const marketPrompt = [
    "请基于以下KWEB前10成分股的股票数据和相关新闻，输出中文市场总览，最多200字。",
    "要求：只基于提供的信息总结；语言客观；不要分点；不要投资建议。",
    `股票数据:\n${quoteLines}`,
    allMarketNewsLines ? `相关新闻:\n${allMarketNewsLines}` : "相关新闻: 无"
  ].join("\n\n");

  const marketOverviewRaw = (await callAiCompatible(
    env,
    "你是中概日报主编，请输出一段不超过200字的中文市场总览。",
    marketPrompt
  )) ?? "";
  const marketOverview = truncateByChars(marketOverviewRaw, 200);

  return { stockSummaryBySymbol, marketOverview };
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
  }
): Promise<void> {
  if (!env.DB) {
    return;
  }

  await ensureD1Schema(env.DB);

  const runResult = await env.DB.prepare(
    "INSERT INTO report_runs (report_date_et, file_name, markdown, market_overview) VALUES (?, ?, ?, ?)"
  )
    .bind(input.reportDateEt, input.fileName, input.markdown, input.marketOverview)
    .run();

  const runId = Number(runResult.meta.last_row_id ?? 0);
  if (!runId) {
    return;
  }

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
    "CREATE INDEX IF NOT EXISTS idx_report_runs_date ON report_runs(report_date_et)",
    "CREATE INDEX IF NOT EXISTS idx_report_news_run_symbol ON report_news(run_id, symbol)"
  ];

  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}

