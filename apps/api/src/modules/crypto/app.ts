import { Hono } from "hono";
import {
  buildCryptoIntelligenceWall,
  listCryptoIntelligenceKeywordAliases,
  notifyHighPriorityCryptoIntelligence,
} from "./intelligence.ts";
import {
  getCryptoNewsAdminClusterDetail,
  getNewsEventDetail,
  getCryptoNewsAdminOverview,
  getReportDateNewsSnapshot,
  getCryptoNewsSchemaStatements,
  listCoinEventTimeline,
  listCoinNews,
  listCryptoNewsAdminClusters,
  listCryptoNewsAdminItems,
  listCryptoNewsAdminRaw,
  listMarketNews,
  listRecentNewsClusters,
  reprocessCryptoNews,
  setCryptoNewsClusterRepresentative,
  runHourlyNewsIngestion
} from "./news.ts";
import {
  createEmptyCryptoMacroSnapshot,
  getCryptoMacroAdminOverview,
  getCryptoMacroSchemaStatements,
  getLatestCryptoMacroSnapshot,
  getReportDateCryptoMacroSnapshot,
  refreshCryptoMacroSnapshot
} from "./macro.ts";
import { trackSchedulerRun, type SchedulerStatusBucket } from "../../scheduler-status.ts";

interface Env {
  DB?: D1Database;
  ADMIN_TOKEN?: string;
  WEBHOOK_URL?: string;
  STATUS_BUCKET?: SchedulerStatusBucket;
  AI?: {
    run(model: string, input: unknown): Promise<unknown>;
  };
}

const BLOCKED_COUNTRIES = new Set(["CN"]);

type CoinSeed = {
  rank: number;
  code: string;
  pair: string;
  nameZh: string;
  nameEn: string;
  corePositionZh: string;
  corePositionEn: string;
  annualQuoteVolumeUsdt: number;
};

type CoinRecord = CoinSeed & {
  annualTradeSharePct: number;
  isActive: boolean;
};

type BinanceTicker24h = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
  closeTime: number;
};

type DailySnapshot = {
  reportDate?: string;
  code: string;
  pair: string;
  priceUsdt: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  quoteVolume24hUsdt: number;
  tradeSharePct: number;
  closeTime: string;
};

type DailyReport = {
  reportDate: string;
  generatedAt: string;
  summaryZh: string;
  summaryEn: string;
  totalQuoteVolumeUsdt: number;
  upCount: number;
  downCount: number;
  flatCount: number;
  leaderCode: string | null;
  leaderChange24hPct: number | null;
  laggardCode: string | null;
  laggardChange24hPct: number | null;
  items: DailySnapshot[];
};

type ReportListItem = {
  reportDate: string;
  generatedAt: string;
  totalQuoteVolumeUsdt: number;
  upCount: number;
  downCount: number;
  flatCount: number;
};

const CF_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const CRYPTO_NEWS_CRON = "10 * * * *";
const REPORT_TIMEZONE = "UTC";
const AI_REQUEST_TIMEOUT_MS = 12000;

function resolveCountryCodes(request: Request): string[] {
  const requestCountry =
    typeof request.cf === "object" && request.cf && "country" in request.cf && typeof request.cf.country === "string"
      ? request.cf.country
      : null;
  const values = [
    requestCountry,
    request.headers.get("x-country-code"),
    request.headers.get("cf-ipcountry")
  ];

  return [...new Set(values.map((value) => value?.trim().toUpperCase()).filter((value): value is string => Boolean(value)))];
}

function isGeoBlocked(request: Request): boolean {
  return resolveCountryCodes(request).some((countryCode) => BLOCKED_COUNTRIES.has(countryCode));
}

function createGeoBlockedResponse(): Response {
  return Response.json(
    {
      error: "geo_blocked",
      message: "Access from your region is not allowed."
    },
    { status: 403 }
  );
}

const COIN_SEEDS: CoinSeed[] = [
  {
    rank: 1,
    code: "BTC",
    pair: "BTCUSDT",
    nameZh: "比特币",
    nameEn: "Bitcoin",
    corePositionZh: "加密货币龙头，数字黄金，支付与储值核心资产",
    corePositionEn: "Flagship crypto asset, digital gold, and a core payment and store-of-value asset.",
    annualQuoteVolumeUsdt: 767301523621.0726
  },
  {
    rank: 2,
    code: "ETH",
    pair: "ETHUSDT",
    nameZh: "以太坊",
    nameEn: "Ethereum",
    corePositionZh: "智能合约平台，DeFi 与链上应用生态核心",
    corePositionEn: "Smart contract platform at the center of DeFi and on-chain applications.",
    annualQuoteVolumeUsdt: 633278049478.0023
  },
  {
    rank: 3,
    code: "USDC",
    pair: "USDCUSDT",
    nameZh: "美元硬币",
    nameEn: "USD Coin",
    corePositionZh: "美元稳定币，链上结算与交易流动性的重要组成部分",
    corePositionEn: "Dollar stablecoin used widely for on-chain settlement and trading liquidity.",
    annualQuoteVolumeUsdt: 548222912515.26184
  },
  {
    rank: 4,
    code: "SOL",
    pair: "SOLUSDT",
    nameZh: "索拉纳",
    nameEn: "Solana",
    corePositionZh: "高性能公链，主打高吞吐与低手续费",
    corePositionEn: "High-throughput layer-1 focused on speed and low transaction costs.",
    annualQuoteVolumeUsdt: 258569927262.87622
  },
  {
    rank: 5,
    code: "XRP",
    pair: "XRPUSDT",
    nameZh: "瑞波币",
    nameEn: "XRP",
    corePositionZh: "跨境支付导向资产，长期围绕清算与汇款场景",
    corePositionEn: "Asset associated with cross-border settlement and remittance use cases.",
    annualQuoteVolumeUsdt: 184152632212.22943
  },
  {
    rank: 6,
    code: "FDUSD",
    pair: "FDUSDUSDT",
    nameZh: "第一数字美元",
    nameEn: "First Digital USD",
    corePositionZh: "美元稳定币，用于交易计价与资金停泊",
    corePositionEn: "Dollar stablecoin used for trading denomination and capital parking.",
    annualQuoteVolumeUsdt: 149545765506.32138
  },
  {
    rank: 7,
    code: "DOGE",
    pair: "DOGEUSDT",
    nameZh: "狗狗币",
    nameEn: "Dogecoin",
    corePositionZh: "社区驱动的模因币，兼具支付叙事与高波动交易属性",
    corePositionEn: "Community-driven meme asset with payment branding and high-volatility trading activity.",
    annualQuoteVolumeUsdt: 105912115783.95258
  },
  {
    rank: 8,
    code: "BNB",
    pair: "BNBUSDT",
    nameZh: "币安币",
    nameEn: "BNB",
    corePositionZh: "币安生态代币，覆盖手续费折扣与链上生态使用场景",
    corePositionEn: "Utility token across the Binance ecosystem, from fee discounts to on-chain usage.",
    annualQuoteVolumeUsdt: 92179918835.04962
  },
  {
    rank: 9,
    code: "SUI",
    pair: "SUIUSDT",
    nameZh: "Sui",
    nameEn: "Sui",
    corePositionZh: "新一代高性能公链，强调并行执行与用户体验",
    corePositionEn: "High-performance newer layer-1 focused on parallel execution and user experience.",
    annualQuoteVolumeUsdt: 69107749683.60535
  },
  {
    rank: 10,
    code: "TRUMP",
    pair: "TRUMPUSDT",
    nameZh: "官方特朗普币",
    nameEn: "Official Trump",
    corePositionZh: "高热度事件驱动型代币，交易情绪与话题性较强",
    corePositionEn: "Event-driven token with high attention, sentiment sensitivity, and headline-driven trading.",
    annualQuoteVolumeUsdt: 66155758947.43396
  }
];

const TOTAL_ANNUAL_QUOTE_VOLUME = COIN_SEEDS.reduce((sum, item) => sum + item.annualQuoteVolumeUsdt, 0);
const COINS: CoinRecord[] = COIN_SEEDS.map((item) => ({
  ...item,
  annualTradeSharePct: TOTAL_ANNUAL_QUOTE_VOLUME > 0 ? (item.annualQuoteVolumeUsdt / TOTAL_ANNUAL_QUOTE_VOLUME) * 100 : 0,
  isActive: true
}));

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  if (isGeoBlocked(c.req.raw)) {
    return createGeoBlockedResponse();
  }
  await next();
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "market-dailies-api/crypto",
    whitelistSize: COINS.length,
    timezone: REPORT_TIMEZONE
  })
);

app.get("/coins", async (c) => {
  const items = c.env.DB ? await listCoins(c.env.DB) : COINS;
  return c.json({ items });
});

app.get("/latest", async (c) => {
  const report = await getLatestOrGenerateReport(c.env);
  if (!report) {
    return c.json({ message: "No report available." }, 404);
  }
  return c.json(report);
});

app.get("/report/:date", async (c) => {
  const reportDate = c.req.param("date").trim();
  if (!isIsoDate(reportDate)) {
    return c.json({ message: "Invalid report date." }, 400);
  }

  const report = c.env.DB ? await getReportByDate(c.env.DB, reportDate) : null;
  if (!report) {
    return c.json({ message: "Report not found." }, 404);
  }

  return c.json(report);
});

app.get("/reports", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 30, 1, 120);
  if (!c.env.DB) {
    return c.json({ items: [] satisfies ReportListItem[] });
  }
  const items = await listReports(c.env.DB, limit);
  return c.json({ items });
});

app.get("/coin/:code", async (c) => {
  const code = c.req.param("code").trim().toUpperCase();
  const coin = c.env.DB ? await getCoinByCode(c.env.DB, code) : COINS.find((item) => item.code === code) ?? null;
  if (!coin) {
    return c.json({ message: "Coin not found." }, 404);
  }

  const [history, eventTimeline] = c.env.DB
    ? await Promise.all([getCoinHistory(c.env.DB, code, 30), listCoinEventTimeline(c.env.DB, code, { limit: 12 })])
    : [[], []];
  const latestSnapshot = history[0] ?? null;
  return c.json({
    coin,
    latestSnapshot,
    history,
    eventTimeline
  });
});

app.get("/macro/latest", async (c) => {
  if (!c.env.DB) {
    return c.json(createEmptyCryptoMacroSnapshot());
  }

  await ensureD1Schema(c.env.DB);
  await refreshCryptoMacroSnapshot(c.env);
  const snapshot = await getLatestCryptoMacroSnapshot(c.env.DB);
  return c.json(snapshot);
});

app.get("/macro/report/:date", async (c) => {
  const reportDate = c.req.param("date").trim();
  if (!isIsoDate(reportDate)) {
    return c.json({ message: "Invalid report date." }, 400);
  }

  if (!c.env.DB) {
    return c.json(createEmptyCryptoMacroSnapshot());
  }

  await ensureD1Schema(c.env.DB);
  if (reportDate === formatDate(new Date())) {
    await refreshCryptoMacroSnapshot(c.env);
  }
  const snapshot = await getReportDateCryptoMacroSnapshot(c.env.DB, reportDate);
  return c.json(snapshot);
});

app.get("/macro/admin/overview", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }

  const overview = await getCryptoMacroAdminOverview(c.env);
  return c.json(overview);
});

app.get("/macro/admin/refresh", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  await ensureD1Schema(c.env.DB);
  await refreshCryptoMacroSnapshot(c.env, { force: true });
  const overview = await getCryptoMacroAdminOverview(c.env);
  return c.json({
    ok: true,
    ...overview
  });
});

app.get("/news/market/latest", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 20, 1, 50);
  const hours = parseLimit(c.req.query("hours"), 24, 1, 168);
  const topic = c.req.query("topic")?.trim() ?? null;
  if (!c.env.DB) {
    return c.json({ items: [] });
  }

  const items = await listMarketNews(c.env.DB, { limit, hours, topic });
  return c.json({ items });
});

app.get("/news/coin/:code", async (c) => {
  const code = c.req.param("code").trim().toUpperCase();
  const coin = c.env.DB ? await getCoinByCode(c.env.DB, code) : COINS.find((item) => item.code === code) ?? null;
  if (!coin) {
    return c.json({ message: "Coin not found." }, 404);
  }

  const limit = parseLimit(c.req.query("limit"), 20, 1, 50);
  const hours = parseLimit(c.req.query("hours"), 24, 1, 168);
  const reportDate = c.req.query("date")?.trim() ?? null;
  if (reportDate && !isIsoDate(reportDate)) {
    return c.json({ message: "Invalid report date." }, 400);
  }
  const items = c.env.DB ? await listCoinNews(c.env.DB, code, { limit, hours, reportDate }) : [];
  return c.json({
    coinCode: code,
    reportDate,
    items
  });
});

app.get("/news/clusters", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 20, 1, 50);
  const hours = parseLimit(c.req.query("hours"), 36, 1, 168);
  if (!c.env.DB) {
    return c.json({ items: [] });
  }

  const items = await listRecentNewsClusters(c.env.DB, { limit, hours });
  return c.json({ items });
});

app.get("/news/event/:clusterId", async (c) => {
  const clusterId = Number.parseInt(c.req.param("clusterId"), 10);
  if (!Number.isInteger(clusterId) || clusterId <= 0) {
    return c.json({ message: "Invalid cluster id." }, 400);
  }
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const detail = await getNewsEventDetail(c.env.DB, clusterId);
  if (!detail) {
    return c.json({ message: "Event not found." }, 404);
  }

  return c.json(detail);
});

app.get("/news/report/:date", async (c) => {
  const reportDate = c.req.param("date").trim();
  if (!isIsoDate(reportDate)) {
    return c.json({ message: "Invalid report date." }, 400);
  }
  if (!c.env.DB) {
    return c.json({
      reportDate,
      macro: createEmptyCryptoMacroSnapshot(),
      marketNews: [],
      clusters: [],
      coinNewsByCode: {}
    });
  }

  await ensureD1Schema(c.env.DB);

  if (reportDate === formatDate(new Date())) {
    await refreshCryptoMacroSnapshot(c.env);
  }
  const snapshot = await getReportDateNewsSnapshot(c.env.DB, reportDate);
  return c.json(snapshot);
});

app.get("/intelligence/aliases", (c) => {
  return c.json({ items: listCryptoIntelligenceKeywordAliases() });
});

app.get("/intelligence/latest", async (c) => {
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const latestReport = await getLatestOrGenerateReport(c.env);
  if (!latestReport) {
    return c.json({ message: "No report available." }, 404);
  }

  const wall = await buildCryptoIntelligenceWall(c.env.DB, latestReport.reportDate);
  return c.json(wall);
});

app.get("/intelligence/report/:date", async (c) => {
  const reportDate = c.req.param("date").trim();
  if (!isIsoDate(reportDate)) {
    return c.json({ message: "Invalid report date." }, 400);
  }
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const wall = await buildCryptoIntelligenceWall(c.env.DB, reportDate);
  return c.json(wall);
});

app.get("/news/admin/run", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }

  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const result = await trackSchedulerRun(
    c.env.STATUS_BUCKET,
    {
      jobKey: "crypto_news_ingestion",
      triggerType: "manual",
      triggerLabel: "crypto:/news/admin/run",
      onSuccess: () => ({
        message: "Crypto news ingestion completed."
      })
    },
    () => runHourlyNewsIngestion(c.env, COINS)
  );
  await notifyHighPriorityCryptoIntelligence(c.env.DB, c.env.WEBHOOK_URL).catch((error) => {
    console.error(`Crypto intelligence webhook failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  return c.json({
    ok: true,
    ...result
  });
});

app.get("/news/admin/overview", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const overview = await getCryptoNewsAdminOverview(c.env.DB);
  return c.json(overview);
});

app.get("/news/admin/raw", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ items: [] });
  }

  const limit = parseLimit(c.req.query("limit"), 50, 1, 200);
  const status = c.req.query("status")?.trim() ?? null;
  const items = await listCryptoNewsAdminRaw(c.env.DB, { limit, status });
  return c.json({ items });
});

app.get("/news/admin/items", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ items: [] });
  }

  const limit = parseLimit(c.req.query("limit"), 50, 1, 200);
  const displayOnly = c.req.query("displayOnly") === "true";
  const items = await listCryptoNewsAdminItems(c.env.DB, { limit, displayOnly });
  return c.json({ items });
});

app.get("/news/admin/clusters", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ items: [] });
  }

  const limit = parseLimit(c.req.query("limit"), 30, 1, 200);
  const query = c.req.query("query")?.trim() ?? null;
  const coinCode = c.req.query("coinCode")?.trim().toUpperCase() ?? null;
  const items = await listCryptoNewsAdminClusters(c.env.DB, { limit, query, coinCode });
  return c.json({ items });
});

app.get("/news/admin/cluster/:clusterId", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const clusterId = Number.parseInt(c.req.param("clusterId"), 10);
  if (!Number.isInteger(clusterId) || clusterId <= 0) {
    return c.json({ message: "Invalid cluster id." }, 400);
  }

  const detail = await getCryptoNewsAdminClusterDetail(c.env.DB, clusterId);
  if (!detail) {
    return c.json({ message: "Cluster not found." }, 404);
  }
  return c.json(detail);
});

app.get("/news/admin/cluster/:clusterId/promote/:newsItemId", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const clusterId = Number.parseInt(c.req.param("clusterId"), 10);
  const newsItemId = Number.parseInt(c.req.param("newsItemId"), 10);
  if (!Number.isInteger(clusterId) || clusterId <= 0 || !Number.isInteger(newsItemId) || newsItemId <= 0) {
    return c.json({ message: "Invalid cluster or news item id." }, 400);
  }

  const detail = await setCryptoNewsClusterRepresentative(c.env.DB, clusterId, newsItemId);
  if (!detail) {
    return c.json({ message: "Cluster or news item not found." }, 404);
  }

  return c.json({
    ok: true,
    detail
  });
});

app.get("/news/admin/reprocess", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }
  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const hours = parseLimit(c.req.query("hours"), 72, 1, 720);
  const limit = parseLimit(c.req.query("limit"), 60, 1, 200);
  const result = await reprocessCryptoNews(c.env, COINS, { hours, limit });
  return c.json({
    ok: true,
    ...result
  });
});

app.get("/run", async (c) => {
  if (!hasValidAdminToken(c)) {
    return c.json({ message: "Unauthorized." }, 401);
  }

  if (!c.env.DB) {
    return c.json({ message: "DB binding is required." }, 500);
  }

  const report = await trackSchedulerRun(
    c.env.STATUS_BUCKET,
    {
      jobKey: "crypto_daily_report",
      triggerType: "manual",
      triggerLabel: "crypto:/run",
      onSuccess: (result) => ({
        message: "Crypto daily report generated.",
        metadata: {
          reportDate: result.reportDate,
          itemCount: result.items.length
        }
      })
    },
    () => generateAndPersistReport(c.env)
  );
  return c.json(report);
});

app.get("/", (c) =>
  c.json({
    service: "market-dailies-api/crypto",
    endpoints: [
      "/health",
      "/coins",
      "/latest",
      "/report/:date",
      "/reports",
      "/coin/:code",
      "/macro/latest",
      "/macro/report/:date",
      "/macro/admin/overview",
      "/macro/admin/refresh",
      "/news/market/latest",
      "/news/coin/:code",
      "/news/clusters",
      "/news/event/:clusterId",
      "/news/report/:date",
      "/intelligence/aliases",
      "/intelligence/latest",
      "/intelligence/report/:date",
      "/news/admin/run",
      "/news/admin/overview",
      "/news/admin/raw",
      "/news/admin/items",
      "/news/admin/clusters",
      "/news/admin/cluster/:clusterId",
      "/news/admin/cluster/:clusterId/promote/:newsItemId",
      "/news/admin/reprocess",
      "/run"
    ]
  })
);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    if (!env.DB) {
      throw new Error("DB binding is required for scheduled generation.");
    }

    await ensureD1Schema(env.DB);

    if (event.cron === CRYPTO_NEWS_CRON) {
      await refreshCryptoMacroSnapshot(env);
      await runHourlyNewsIngestion(env, COINS);
      await notifyHighPriorityCryptoIntelligence(env.DB, env.WEBHOOK_URL).catch((error) => {
        console.error(`Crypto intelligence webhook failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      return;
    }

    await refreshCryptoMacroSnapshot(env);
    await generateAndPersistReport(env);
  }
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseLimit(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

async function getLatestOrGenerateReport(env: Env): Promise<DailyReport | null> {
  if (!env.DB) {
    return buildEphemeralReport(env);
  }

  await ensureD1Schema(env.DB);
  const today = formatDate(new Date());
  const todayReport = await getReportByDate(env.DB, today);
  if (todayReport) {
    return todayReport;
  }

  const latest = await getLatestReport(env.DB);
  if (latest) {
    return latest;
  }

  return generateAndPersistReport(env);
}

async function buildEphemeralReport(env: Env): Promise<DailyReport> {
  const items = await fetchDailySnapshots();
  const base = buildReportMetrics(items);
  const summaries = await buildAiSummaries(env, items, base);
  return {
    reportDate: formatDate(new Date()),
    generatedAt: new Date().toISOString(),
    summaryZh: summaries.summaryZh,
    summaryEn: summaries.summaryEn,
    ...base,
    items
  };
}

async function generateAndPersistReport(env: Env): Promise<DailyReport> {
  if (!env.DB) {
    return buildEphemeralReport(env);
  }

  await ensureD1Schema(env.DB);
  await seedCoins(env.DB);

  const reportDate = formatDate(new Date());
  const items = await fetchDailySnapshots();
  const base = buildReportMetrics(items);
  const summaries = await buildAiSummaries(env, items, base);
  const report: DailyReport = {
    reportDate,
    generatedAt: new Date().toISOString(),
    summaryZh: summaries.summaryZh,
    summaryEn: summaries.summaryEn,
    ...base,
    items
  };

  await persistReport(env.DB, report);
  const persisted = await getReportByDate(env.DB, reportDate);
  return persisted ?? report;
}

async function fetchDailySnapshots(): Promise<DailySnapshot[]> {
  const response = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Binance ticker request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as BinanceTicker24h[];
  const tickerBySymbol = new Map(payload.map((item) => [item.symbol, item]));

  const rawItems = COINS.map((coin) => {
    const ticker = tickerBySymbol.get(coin.pair);
    if (!ticker) {
      throw new Error(`Missing Binance ticker for ${coin.pair}.`);
    }

    return {
      code: coin.code,
      pair: coin.pair,
      priceUsdt: toNumber(ticker.lastPrice),
      change24hPct: toNumber(ticker.priceChangePercent),
      high24h: toNumber(ticker.highPrice),
      low24h: toNumber(ticker.lowPrice),
      quoteVolume24hUsdt: toNumber(ticker.quoteVolume),
      closeTime: new Date(ticker.closeTime).toISOString()
    };
  });

  const totalQuoteVolumeUsdt = rawItems.reduce((sum, item) => sum + item.quoteVolume24hUsdt, 0);
  return rawItems.map((item) => ({
    ...item,
    tradeSharePct: totalQuoteVolumeUsdt > 0 ? (item.quoteVolume24hUsdt / totalQuoteVolumeUsdt) * 100 : 0
  }));
}

function buildReportMetrics(items: DailySnapshot[]): Omit<DailyReport, "reportDate" | "generatedAt" | "summaryZh" | "summaryEn" | "items"> {
  const totalQuoteVolumeUsdt = items.reduce((sum, item) => sum + item.quoteVolume24hUsdt, 0);
  const upCount = items.filter((item) => item.change24hPct > 0).length;
  const downCount = items.filter((item) => item.change24hPct < 0).length;
  const flatCount = items.length - upCount - downCount;
  const sorted = [...items].sort((a, b) => b.change24hPct - a.change24hPct || a.code.localeCompare(b.code));
  const leader = sorted[0] ?? null;
  const laggard = sorted[sorted.length - 1] ?? null;

  return {
    totalQuoteVolumeUsdt,
    upCount,
    downCount,
    flatCount,
    leaderCode: leader?.code ?? null,
    leaderChange24hPct: leader?.change24hPct ?? null,
    laggardCode: laggard?.code ?? null,
    laggardChange24hPct: laggard?.change24hPct ?? null
  };
}

async function buildAiSummaries(
  env: Env,
  items: DailySnapshot[],
  metrics: ReturnType<typeof buildReportMetrics>
): Promise<{ summaryZh: string; summaryEn: string }> {
  const fallbackZh = buildFallbackSummaryZh(items, metrics);
  const fallbackEn = buildFallbackSummaryEn(items, metrics);
  if (!env.AI) {
    return { summaryZh: fallbackZh, summaryEn: fallbackEn };
  }

  const leader = items.find((item) => item.code === metrics.leaderCode) ?? null;
  const laggard = items.find((item) => item.code === metrics.laggardCode) ?? null;
  const compactPayload = items.map((item) => ({
    code: item.code,
    priceUsdt: round(item.priceUsdt, 4),
    change24hPct: round(item.change24hPct, 2),
    quoteVolume24hUsdt: round(item.quoteVolume24hUsdt, 2),
    tradeSharePct: round(item.tradeSharePct, 2)
  }));

  const sharedInput = JSON.stringify(
    {
      reportDate: formatDate(new Date()),
      totalQuoteVolumeUsdt: round(metrics.totalQuoteVolumeUsdt, 2),
      upCount: metrics.upCount,
      downCount: metrics.downCount,
      flatCount: metrics.flatCount,
      leader,
      laggard,
      items: compactPayload
    },
    null,
    2
  );

  const summaryZh =
    (await requestAiSummary(env, {
      systemPrompt:
        "你是加密货币日报编辑。基于输入的结构化行情数据写 120 到 180 字中文市场总览。只做事实总结，不给投资建议，不使用 Markdown 列表。",
      userPrompt: sharedInput
    })) ?? fallbackZh;

  const summaryEn =
    (await requestAiSummary(env, {
      systemPrompt:
        "You are an editor for a crypto daily report. Write a concise 90 to 140 word English market recap using only the structured market data provided. Stay factual, do not give investment advice, and do not use markdown bullet lists.",
      userPrompt: sharedInput
    })) ?? fallbackEn;

  return {
    summaryZh: summaryZh.trim(),
    summaryEn: summaryEn.trim()
  };
}

function buildFallbackSummaryZh(
  items: DailySnapshot[],
  metrics: ReturnType<typeof buildReportMetrics>
): string {
  const leader = items.find((item) => item.code === metrics.leaderCode) ?? null;
  const laggard = items.find((item) => item.code === metrics.laggardCode) ?? null;
  return `今日追踪的 ${items.length} 个币种中，上涨 ${metrics.upCount} 个，下跌 ${metrics.downCount} 个，持平 ${metrics.flatCount} 个。24 小时总交易额约 ${formatCompactUsd(metrics.totalQuoteVolumeUsdt)}。${leader ? `${leader.code} 以 ${formatSignedPct(leader.change24hPct)} 领涨，` : ""}${laggard ? `${laggard.code} 以 ${formatSignedPct(laggard.change24hPct)} 表现最弱。` : ""}当前市场仍以主流币和稳定币流动性为核心，情绪偏向对短线波动的消化。`;
}

function buildFallbackSummaryEn(
  items: DailySnapshot[],
  metrics: ReturnType<typeof buildReportMetrics>
): string {
  const leader = items.find((item) => item.code === metrics.leaderCode) ?? null;
  const laggard = items.find((item) => item.code === metrics.laggardCode) ?? null;
  return `Across the ${items.length} tracked assets, ${metrics.upCount} are up, ${metrics.downCount} are down, and ${metrics.flatCount} are flat over the last 24 hours. Combined traded value is about ${formatCompactUsd(metrics.totalQuoteVolumeUsdt)}. ${leader ? `${leader.code} leads with ${formatSignedPct(leader.change24hPct)}, ` : ""}${laggard ? `while ${laggard.code} trails at ${formatSignedPct(laggard.change24hPct)}.` : ""}Liquidity remains concentrated in the largest pairs, with short-term positioning still dominating market tone.`;
}

async function requestAiSummary(
  env: Env,
  input: {
    systemPrompt: string;
    userPrompt: string;
  }
): Promise<string | null> {
  if (!env.AI) {
    return null;
  }

  try {
    const payload = await Promise.race([
      env.AI.run(CF_AI_MODEL, {
        messages: [
          {
            role: "system",
            content: input.systemPrompt
          },
          {
            role: "user",
            content: input.userPrompt
          }
        ],
        max_tokens: 220,
        temperature: 0.2
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out after ${AI_REQUEST_TIMEOUT_MS}ms`)), AI_REQUEST_TIMEOUT_MS);
      })
    ]);
    return extractAiText(payload);
  } catch (error) {
    console.error(`Workers AI summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function extractAiText(payload: unknown): string | null {
  if (typeof payload === "string") {
    return normalizeAiText(payload);
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const directCandidates = [record.output_text, record.response, record.result, record.text];
  for (const candidate of directCandidates) {
    const extracted = extractAiText(candidate);
    if (extracted) {
      return extracted;
    }
  }

  const output = record.output;
  if (Array.isArray(output)) {
    const textParts = output
      .flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }
        const outputRecord = item as Record<string, unknown>;
        const content = outputRecord.content;
        if (Array.isArray(content)) {
          return content
            .map((part) => {
              if (!part || typeof part !== "object") {
                return null;
              }
              const text = (part as Record<string, unknown>).text;
              return typeof text === "string" ? text.trim() : null;
            })
            .filter((value): value is string => !!value);
        }
        const text = outputRecord.text;
        return typeof text === "string" ? [text.trim()] : [];
      })
      .filter((value) => value.length > 0);

    if (textParts.length > 0) {
      return textParts.join("\n").trim();
    }
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];
    if (firstChoice && typeof firstChoice === "object") {
      const message = (firstChoice as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string" && content.trim().length > 0) {
          return normalizeAiText(content);
        }
      }
    }
  }

  return null;
}

function normalizeAiText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const candidate = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : trimmed;
  const lines = candidate
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : candidate;

  const normalized = lastLine.replace(/^["“]|["”]$/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

async function ensureD1Schema(db: D1Database): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank INTEGER NOT NULL,
      code TEXT NOT NULL,
      pair TEXT NOT NULL,
      name_zh TEXT NOT NULL,
      name_en TEXT NOT NULL,
      core_position_zh TEXT NOT NULL,
      core_position_en TEXT NOT NULL,
      annual_quote_volume_usdt REAL NOT NULL,
      annual_trade_share_pct REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_coins_code_unique ON coins(code)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_coins_rank_unique ON coins(rank)`,
    `CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      total_quote_volume_usdt REAL NOT NULL,
      up_count INTEGER NOT NULL,
      down_count INTEGER NOT NULL,
      flat_count INTEGER NOT NULL,
      leader_code TEXT,
      leader_change_24h_pct REAL,
      laggard_code TEXT,
      laggard_change_24h_pct REAL,
      generated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_date_unique ON daily_reports(report_date)`,
    `CREATE TABLE IF NOT EXISTS daily_coin_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      pair TEXT NOT NULL,
      price_usdt REAL NOT NULL,
      change_24h_pct REAL NOT NULL,
      high_24h REAL NOT NULL,
      low_24h REAL NOT NULL,
      quote_volume_24h_usdt REAL NOT NULL,
      trade_share_pct REAL NOT NULL,
      close_time TEXT NOT NULL,
      FOREIGN KEY(report_id) REFERENCES daily_reports(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_daily_coin_snapshots_report_code ON daily_coin_snapshots(report_id, code)`,
    `CREATE INDEX IF NOT EXISTS idx_daily_coin_snapshots_code_report ON daily_coin_snapshots(code, report_id)`,
    ...getCryptoMacroSchemaStatements(),
    ...getCryptoNewsSchemaStatements()
  ];

  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}

async function seedCoins(db: D1Database): Promise<void> {
  const existing = await db.prepare("SELECT COUNT(1) AS count FROM coins").first<{ count: number }>();
  if ((existing?.count ?? 0) >= COINS.length) {
    return;
  }

  for (const coin of COINS) {
    await db
      .prepare(
        `INSERT INTO coins (
          rank,
          code,
          pair,
          name_zh,
          name_en,
          core_position_zh,
          core_position_en,
          annual_quote_volume_usdt,
          annual_trade_share_pct,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          rank = excluded.rank,
          pair = excluded.pair,
          name_zh = excluded.name_zh,
          name_en = excluded.name_en,
          core_position_zh = excluded.core_position_zh,
          core_position_en = excluded.core_position_en,
          annual_quote_volume_usdt = excluded.annual_quote_volume_usdt,
          annual_trade_share_pct = excluded.annual_trade_share_pct,
          is_active = excluded.is_active,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        coin.rank,
        coin.code,
        coin.pair,
        coin.nameZh,
        coin.nameEn,
        coin.corePositionZh,
        coin.corePositionEn,
        coin.annualQuoteVolumeUsdt,
        coin.annualTradeSharePct,
        coin.isActive ? 1 : 0
      )
      .run();
  }
}

async function persistReport(db: D1Database, report: DailyReport): Promise<void> {
  await db
    .prepare(
      `INSERT INTO daily_reports (
        report_date,
        summary_zh,
        summary_en,
        total_quote_volume_usdt,
        up_count,
        down_count,
        flat_count,
        leader_code,
        leader_change_24h_pct,
        laggard_code,
        laggard_change_24h_pct,
        generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(report_date) DO UPDATE SET
        summary_zh = excluded.summary_zh,
        summary_en = excluded.summary_en,
        total_quote_volume_usdt = excluded.total_quote_volume_usdt,
        up_count = excluded.up_count,
        down_count = excluded.down_count,
        flat_count = excluded.flat_count,
        leader_code = excluded.leader_code,
        leader_change_24h_pct = excluded.leader_change_24h_pct,
        laggard_code = excluded.laggard_code,
        laggard_change_24h_pct = excluded.laggard_change_24h_pct,
        generated_at = excluded.generated_at`
    )
    .bind(
      report.reportDate,
      report.summaryZh,
      report.summaryEn,
      report.totalQuoteVolumeUsdt,
      report.upCount,
      report.downCount,
      report.flatCount,
      report.leaderCode,
      report.leaderChange24hPct,
      report.laggardCode,
      report.laggardChange24hPct,
      report.generatedAt
    )
    .run();

  const run = await db.prepare("SELECT id FROM daily_reports WHERE report_date = ? LIMIT 1").bind(report.reportDate).first<{ id: number }>();
  const reportId = Number(run?.id ?? 0);
  if (!reportId) {
    return;
  }

  await db.prepare("DELETE FROM daily_coin_snapshots WHERE report_id = ?").bind(reportId).run();

  for (const item of report.items) {
    await db
      .prepare(
        `INSERT INTO daily_coin_snapshots (
          report_id,
          code,
          pair,
          price_usdt,
          change_24h_pct,
          high_24h,
          low_24h,
          quote_volume_24h_usdt,
          trade_share_pct,
          close_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        reportId,
        item.code,
        item.pair,
        item.priceUsdt,
        item.change24hPct,
        item.high24h,
        item.low24h,
        item.quoteVolume24hUsdt,
        item.tradeSharePct,
        item.closeTime
      )
      .run();
  }
}

async function listCoins(db: D1Database): Promise<CoinRecord[]> {
  await ensureD1Schema(db);
  await seedCoins(db);
  const result = await db
    .prepare(
      `SELECT
        rank AS rank,
        code AS code,
        pair AS pair,
        name_zh AS nameZh,
        name_en AS nameEn,
        core_position_zh AS corePositionZh,
        core_position_en AS corePositionEn,
        annual_quote_volume_usdt AS annualQuoteVolumeUsdt,
        annual_trade_share_pct AS annualTradeSharePct,
        is_active AS isActive
      FROM coins
      WHERE is_active = 1
      ORDER BY rank ASC`
    )
    .all<CoinRecord>();

  return (result.results ?? []).map((row) => ({
    ...row,
    isActive: !!row.isActive
  }));
}

async function getCoinByCode(db: D1Database, code: string): Promise<CoinRecord | null> {
  await ensureD1Schema(db);
  await seedCoins(db);
  const row = await db
    .prepare(
      `SELECT
        rank AS rank,
        code AS code,
        pair AS pair,
        name_zh AS nameZh,
        name_en AS nameEn,
        core_position_zh AS corePositionZh,
        core_position_en AS corePositionEn,
        annual_quote_volume_usdt AS annualQuoteVolumeUsdt,
        annual_trade_share_pct AS annualTradeSharePct,
        is_active AS isActive
      FROM coins
      WHERE code = ?
      LIMIT 1`
    )
    .bind(code)
    .first<CoinRecord>();

  if (!row) {
    return null;
  }

  return {
    ...row,
    isActive: !!row.isActive
  };
}

async function getLatestReport(db: D1Database): Promise<DailyReport | null> {
  const latest = await db
    .prepare("SELECT report_date AS reportDate FROM daily_reports ORDER BY report_date DESC LIMIT 1")
    .first<{ reportDate: string }>();
  if (!latest?.reportDate) {
    return null;
  }
  return getReportByDate(db, latest.reportDate);
}

async function getReportByDate(db: D1Database, reportDate: string): Promise<DailyReport | null> {
  await ensureD1Schema(db);
  const report = await db
    .prepare(
      `SELECT
        id AS id,
        report_date AS reportDate,
        summary_zh AS summaryZh,
        summary_en AS summaryEn,
        total_quote_volume_usdt AS totalQuoteVolumeUsdt,
        up_count AS upCount,
        down_count AS downCount,
        flat_count AS flatCount,
        leader_code AS leaderCode,
        leader_change_24h_pct AS leaderChange24hPct,
        laggard_code AS laggardCode,
        laggard_change_24h_pct AS laggardChange24hPct,
        generated_at AS generatedAt
      FROM daily_reports
      WHERE report_date = ?
      LIMIT 1`
    )
    .bind(reportDate)
    .first<DailyReport & { id: number }>();

  if (!report) {
    return null;
  }

  const snapshots = await db
    .prepare(
      `SELECT
        code AS code,
        pair AS pair,
        price_usdt AS priceUsdt,
        change_24h_pct AS change24hPct,
        high_24h AS high24h,
        low_24h AS low24h,
        quote_volume_24h_usdt AS quoteVolume24hUsdt,
        trade_share_pct AS tradeSharePct,
        close_time AS closeTime
      FROM daily_coin_snapshots
      WHERE report_id = ?
      ORDER BY (
        SELECT rank FROM coins WHERE coins.code = daily_coin_snapshots.code
      ) ASC, code ASC`
    )
    .bind(report.id)
    .all<DailySnapshot>();

  return {
    reportDate: report.reportDate,
    generatedAt: report.generatedAt,
    summaryZh: report.summaryZh,
    summaryEn: report.summaryEn,
    totalQuoteVolumeUsdt: report.totalQuoteVolumeUsdt,
    upCount: report.upCount,
    downCount: report.downCount,
    flatCount: report.flatCount,
    leaderCode: report.leaderCode,
    leaderChange24hPct: report.leaderChange24hPct,
    laggardCode: report.laggardCode,
    laggardChange24hPct: report.laggardChange24hPct,
    items: snapshots.results ?? []
  };
}

async function listReports(db: D1Database, limit: number): Promise<ReportListItem[]> {
  await ensureD1Schema(db);
  const result = await db
    .prepare(
      `SELECT
        report_date AS reportDate,
        generated_at AS generatedAt,
        total_quote_volume_usdt AS totalQuoteVolumeUsdt,
        up_count AS upCount,
        down_count AS downCount,
        flat_count AS flatCount
      FROM daily_reports
      ORDER BY report_date DESC
      LIMIT ?`
    )
    .bind(limit)
    .all<ReportListItem>();

  return result.results ?? [];
}

async function getCoinHistory(db: D1Database, code: string, limit: number): Promise<DailySnapshot[]> {
  await ensureD1Schema(db);
  const result = await db
    .prepare(
      `SELECT
        r.report_date AS reportDate,
        s.code AS code,
        s.pair AS pair,
        s.price_usdt AS priceUsdt,
        s.change_24h_pct AS change24hPct,
        s.high_24h AS high24h,
        s.low_24h AS low24h,
        s.quote_volume_24h_usdt AS quoteVolume24hUsdt,
        s.trade_share_pct AS tradeSharePct,
        s.close_time AS closeTime
      FROM daily_coin_snapshots s
      INNER JOIN daily_reports r ON r.id = s.report_id
      WHERE s.code = ?
      ORDER BY r.report_date DESC
      LIMIT ?`
    )
    .bind(code, limit)
    .all<DailySnapshot>();

  return result.results ?? [];
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatSignedPct(value: number): string {
  return `${value > 0 ? "+" : ""}${round(value, 2).toFixed(2)}%`;
}

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function hasValidAdminToken(c: { req: { header(name: string): string | undefined }; env: Env }): boolean {
  const expected = c.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return false;
  }
  const provided = c.req.header("x-admin-token")?.trim();
  return provided === expected;
}
