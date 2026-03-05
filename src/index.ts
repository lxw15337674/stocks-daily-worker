import { Hono } from "hono";

interface Env {
  AI?: Ai;
  DB?: D1Database;
  REPORT_BUCKET?: R2Bucket;
  STOCK_LIST_JSON?: string;
  WEBHOOK_URL?: string;
  AI_GATEWAY_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
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

const DEFAULT_STOCKS: Stock[] = [
  { symbol: "TCEHY", name: "Tencent", aliases: ["腾讯"] },
  { symbol: "BABA", name: "Alibaba", aliases: ["阿里", "阿里巴巴"] },
  { symbol: "PDD", name: "PDD Holdings", aliases: ["拼多多"] },
  { symbol: "JD", name: "JD.com", aliases: ["京东"] },
  { symbol: "BIDU", name: "Baidu", aliases: ["百度"] },
  { symbol: "NTES", name: "NetEase", aliases: ["网易"] },
  { symbol: "TCOM", name: "Trip.com", aliases: ["携程"] },
  { symbol: "YMM", name: "Full Truck Alliance", aliases: ["满帮"] },
  { symbol: "BILI", name: "Bilibili", aliases: ["哔哩哔哩", "B站"] },
  { symbol: "BEKE", name: "KE Holdings", aliases: ["贝壳"] }
];

const ET_TIMEZONE = "America/New_York";
const CN_TIMEZONE = "Asia/Shanghai";
const OPENAPI_VERSION = "3.1.0";
const CF_AI_DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true, service: "china-stocks-daily-worker" }));

app.get("/openapi.json", (c) => {
  const openapi = buildOpenApiSpec(c.req.url);
  return c.json(openapi);
});

app.get("/docs", (c) => {
  const url = new URL(c.req.url);
  const specUrl = `${url.origin}/openapi.json`;
  return c.html(buildDocsHtml(specUrl));
});

app.get("/run", async (c) => {
  const result = await generateAndPersistReport(c.env);
  return new Response(result.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "x-report-file": result.fileName
    }
  });
});

app.get("/latest", async (c) => {
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
});

app.get("/report/:date", async (c) => {
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
});

app.get("/", (c) =>
  c.text(
    "Use /run to generate report, /latest to read latest report, /report/:date to read a specific report, /openapi.json for API spec, /docs for API docs UI, /health for status."
  )
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
    stockSummaryBySymbol: aiSummary.stockSummaryBySymbol,
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
  if (!env.STOCK_LIST_JSON) {
    return DEFAULT_STOCKS;
  }

  try {
    const parsed = JSON.parse(env.STOCK_LIST_JSON) as Stock[];
    return parsed.filter((stock) => stock.symbol && stock.name && Array.isArray(stock.aliases));
  } catch {
    return DEFAULT_STOCKS;
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
  stockSummaryBySymbol: Map<string, string>;
  marketOverview: string;
}): string {
  const { reportDateEt, generatedAtCn, stocks, quotes, newsBySymbol, stockSummaryBySymbol, marketOverview } =
    params;

  const gainers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 10);
  const losers = [...quotes].sort((a, b) => a.changePct - b.changePct).slice(0, 10);

  const up = quotes.filter((q) => q.changePct > 0).length;
  const down = quotes.filter((q) => q.changePct < 0).length;
  const flat = quotes.filter((q) => q.changePct === 0).length;
  const avgChange = quotes.length > 0 ? quotes.reduce((sum, q) => sum + q.changePct, 0) / quotes.length : 0;

  const lines: string[] = [];
  lines.push(`# 中概日报 | ${reportDateEt}（美东交易日）`);
  lines.push("");
  lines.push(`> 生成时间：${generatedAtCn}（北京时间）`);
  lines.push(`> 样本范围：中概核心池（N=${stocks.length}）`);
  lines.push(`> 有效行情：${quotes.length} 只`);
  lines.push("");
  lines.push("## 一、市场概览");
  lines.push(`- 中概整体：上涨 ${up} 家，下跌 ${down} 家，平盘 ${flat} 家`);
  lines.push(`- 平均涨跌幅：${formatSignedPct(avgChange)}`);
  lines.push(`- AI总览：${marketOverview}`);
  lines.push("");
  lines.push("## 二、涨幅榜 TOP 10");
  lines.push("| 排名 | 代码 | 名称 | 收盘价 | 涨跌幅 | 估算成交额 |\n|---|---|---|---:|---:|---:|");
  gainers.forEach((quote, index) => {
    lines.push(
      `| ${index + 1} | ${quote.symbol} | ${quote.name} | ${formatPrice(quote.close, quote.currency)} | ${formatSignedPct(
        quote.changePct
      )} | ${formatMoney(quote.turnoverEstimate, quote.currency)} |`
    );
  });
  lines.push("");
  lines.push("## 三、跌幅榜 TOP 10");
  lines.push("| 排名 | 代码 | 名称 | 收盘价 | 涨跌幅 | 估算成交额 |\n|---|---|---|---:|---:|---:|");
  losers.forEach((quote, index) => {
    lines.push(
      `| ${index + 1} | ${quote.symbol} | ${quote.name} | ${formatPrice(quote.close, quote.currency)} | ${formatSignedPct(
        quote.changePct
      )} | ${formatMoney(quote.turnoverEstimate, quote.currency)} |`
    );
  });
  lines.push("");
  lines.push("## 四、个股新闻汇总（按公司）");

  const symbolsByHotness = stocks
    .map((stock) => stock.symbol)
    .sort((a, b) => (newsBySymbol.get(b)?.length ?? 0) - (newsBySymbol.get(a)?.length ?? 0));

  for (const symbol of symbolsByHotness) {
    const company = stocks.find((stock) => stock.symbol === symbol);
    if (!company) {
      continue;
    }
    const items = newsBySymbol.get(symbol) ?? [];
    if (items.length === 0) {
      continue;
    }

    lines.push(`### ${company.symbol}（${company.name}）`);
    for (const item of items) {
      lines.push(
        `- [${sanitizeTitle(item.title)}](${item.link})（来源：${item.source}，时间：${formatDateTime(item.publishedAt, ET_TIMEZONE)} ET）`
      );
    }
    lines.push(`- 摘要：${stockSummaryBySymbol.get(symbol) ?? sanitizeTitle(items[0].title)}。`);
    lines.push("");
  }

  lines.push("## 五、数据来源与免责声明");
  lines.push("- 行情：Yahoo Finance 免费公开接口");
  lines.push("- 新闻：Google News RSS 公开源");
  lines.push("- 免责声明：本报告仅做公开信息整理，不构成任何投资建议。\n");

  return lines.join("\n");
}

function sanitizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
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

function buildOpenApiSpec(requestUrl: string): Record<string, unknown> {
  const server = new URL(requestUrl).origin;
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: "China Stocks Daily Worker API",
      version: "0.1.0",
      description: "Generate and fetch markdown reports for China ADR daily summary."
    },
    servers: [{ url: server }],
    paths: {
      "/health": {
        get: {
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
        }
      },
      "/run": {
        get: {
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
        }
      },
      "/latest": {
        get: {
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
            "404": { description: "No archived report found" }
          }
        }
      },
      "/report/{date}": {
        get: {
          summary: "Get report by date",
          description:
            "Reads from D1 first, then R2. If missing and date is today (ET), generates on demand.",
          parameters: [
            {
              name: "date",
              in: "path",
              required: true,
              schema: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
              },
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
            "400": { description: "Invalid date format" },
            "404": { description: "Report not found" }
          }
        }
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI schema",
          responses: {
            "200": {
              description: "OpenAPI JSON",
              content: {
                "application/json": {
                  schema: {
                    type: "object"
                  }
                }
              }
            }
          }
        }
      },
      "/docs": {
        get: {
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
        }
      }
    }
  };
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

async function buildAiSummary(
  env: Env,
  stocks: Stock[],
  quotes: Quote[],
  newsBySymbol: Map<string, NewsItem[]>
): Promise<ReportSummary> {
  const stockSummaryBySymbol = new Map<string, string>();

  for (const stock of stocks) {
    const items = newsBySymbol.get(stock.symbol) ?? [];
    if (items.length === 0) {
      continue;
    }

    const quote = quotes.find((q) => q.symbol === stock.symbol);
    const fallback = sanitizeTitle(items[0].title);
    const prompt = [
      `股票: ${stock.symbol} (${stock.name})`,
      quote ? `当日涨跌幅: ${formatSignedPct(quote.changePct)}` : "当日涨跌幅: 无",
      "请根据以下新闻生成一句中文总结，20-40字，聚焦事件影响。",
      ...items.map((item, index) => `${index + 1}. ${sanitizeTitle(item.title)} (${item.source})`)
    ].join("\n");

    const aiText = await callAiGateway(env, "你是财经编辑，请输出客观、简洁的中文总结。", prompt);
    stockSummaryBySymbol.set(stock.symbol, aiText ?? fallback);
  }

  const topMoves = [...quotes]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 5)
    .map((q) => `${q.symbol} ${formatSignedPct(q.changePct)}`)
    .join("; ");

  const stockSummaryLines = Array.from(stockSummaryBySymbol.entries())
    .slice(0, 8)
    .map(([symbol, summary]) => `${symbol}: ${summary}`)
    .join("\n");

  const marketPrompt = [
    "请基于以下中概市场数据生成一句中文总览，30-60字，包含市场情绪和主要驱动。",
    `异动: ${topMoves || "无"}`,
    stockSummaryLines ? `个股摘要:\n${stockSummaryLines}` : "个股摘要: 无"
  ].join("\n\n");

  const marketOverview =
    (await callAiGateway(env, "你是中概日报主编，输出一句客观市场总览。", marketPrompt)) ??
    "当日中概分化运行，重点关注涨跌幅居前个股与对应新闻事件。";

  return { stockSummaryBySymbol, marketOverview };
}

async function callAiGateway(env: Env, systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (env.AI) {
    try {
      const ai = env.AI as unknown as { run: (model: string, input: unknown) => Promise<unknown> };
      const response = await ai.run(env.AI_MODEL ?? CF_AI_DEFAULT_MODEL, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 220,
        temperature: 0.2
      });

      const text = extractCloudflareAiText(response);
      if (text) {
        return text;
      }
    } catch {
      // Fall through to optional gateway call.
    }
  }

  if (!env.AI_GATEWAY_BASE_URL) {
    return null;
  }

  const response = await fetch(env.AI_GATEWAY_BASE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.AI_API_KEY ? { authorization: `Bearer ${env.AI_API_KEY}` } : {})
    },
    body: JSON.stringify({
      model: env.AI_MODEL ?? "gpt-4o-mini",
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

function extractCloudflareAiText(response: unknown): string | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const maybe = response as {
    result?: {
      response?: string;
    };
    response?: string;
  };

  const text = maybe.result?.response ?? maybe.response;
  return typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
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

function buildDocsHtml(specUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>China Stocks Daily Worker API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout'
      });
    </script>
  </body>
</html>`;
}
