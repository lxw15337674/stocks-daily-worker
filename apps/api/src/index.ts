import stocksModule from "./modules/stocks/app.ts";
import cryptoModule from "./modules/crypto/app.ts";
import { readSchedulerStatus, toScheduledForIso, trackSchedulerRun, type SchedulerStatusBucket } from "./scheduler-status.ts";

type WorkersAiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

interface Env {
  STOCKS_DB?: D1Database;
  STOCKS_BROWSER?: Fetcher;
  STOCKS_ADMIN_TOKEN?: string;
  STOCKS_WEBHOOK_URL?: string;
  STOCKS_OPENAI_BASE_URL?: string;
  STOCKS_OPENAI_API_KEY?: string;
  STOCKS_AI_MODEL?: string;
  STOCKS_NEWS_BODY_FETCH_ENABLED?: string;
  STOCKS_NEWS_BODY_PER_STOCK_LIMIT?: string;
  STOCKS_NEWS_BODY_TIMEOUT_MS?: string;
  STOCKS_NEWS_BODY_MAX_CHARS?: string;
  STOCKS_AI_GATEWAY_BASE_URL?: string;
  STOCKS_AI_API_KEY?: string;
  CRYPTO_DB?: D1Database;
  CRYPTO_ADMIN_TOKEN?: string;
  CRYPTO_AI?: WorkersAiBinding;
  CRYPTO_WEBHOOK_URL?: string;
  SCHEDULER_STATUS_BUCKET?: SchedulerStatusBucket;
}

type FetchHandler = (request: Request, env: unknown) => Promise<Response>;
type ScheduledHandler = (event: ScheduledController, env: unknown) => Promise<void>;

const STOCKS_CRON = "0 23 * * 1-5";
const MARKET_INDICES_SUMMARY_CRON_DST = "15 20 * * 1-5";
const MARKET_INDICES_SUMMARY_CRON_STD = "15 21 * * 1-5";
const CRYPTO_NEWS_CRON = "10 0 * * *";
const CRYPTO_CRON = "5 0 * * *";

const ASSET_ITEMS = [
  { key: "stocks", label: "Stocks", enabled: true },
  { key: "crypto", label: "Crypto", enabled: true },
  { key: "gold", label: "Gold", enabled: false },
  { key: "bonds", label: "Bonds", enabled: false }
] as const;

function rewriteRequest(request: Request, pathname: string): Request {
  const nextUrl = new URL(request.url);
  nextUrl.pathname = pathname;

  const init: RequestInit = {
    method: request.method,
    headers: new Headers(request.headers),
    redirect: request.redirect
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return new Request(nextUrl, init);
}

function toStocksEnv(env: Env) {
  return {
    DB: env.STOCKS_DB,
    BROWSER: env.STOCKS_BROWSER,
    ADMIN_TOKEN: env.STOCKS_ADMIN_TOKEN,
    WEBHOOK_URL: env.STOCKS_WEBHOOK_URL,
    OPENAI_BASE_URL: env.STOCKS_OPENAI_BASE_URL,
    OPENAI_API_KEY: env.STOCKS_OPENAI_API_KEY,
    AI_MODEL: env.STOCKS_AI_MODEL,
    NEWS_BODY_FETCH_ENABLED: env.STOCKS_NEWS_BODY_FETCH_ENABLED,
    NEWS_BODY_PER_STOCK_LIMIT: env.STOCKS_NEWS_BODY_PER_STOCK_LIMIT,
    NEWS_BODY_TIMEOUT_MS: env.STOCKS_NEWS_BODY_TIMEOUT_MS,
    NEWS_BODY_MAX_CHARS: env.STOCKS_NEWS_BODY_MAX_CHARS,
    AI_GATEWAY_BASE_URL: env.STOCKS_AI_GATEWAY_BASE_URL,
    AI_API_KEY: env.STOCKS_AI_API_KEY,
    STATUS_BUCKET: env.SCHEDULER_STATUS_BUCKET
  };
}

function toCryptoEnv(env: Env) {
  return {
    DB: env.CRYPTO_DB,
    ADMIN_TOKEN: env.CRYPTO_ADMIN_TOKEN,
    AI: env.CRYPTO_AI,
    WEBHOOK_URL: env.CRYPTO_WEBHOOK_URL,
    STATUS_BUCKET: env.SCHEDULER_STATUS_BUCKET
  };
}

type ScheduledJobConfig = {
  cron: string;
  jobKey: "stocks_daily_report" | "market_indices_summary" | "crypto_news_ingestion" | "crypto_daily_report";
  handler: ScheduledHandler;
  env: unknown;
};

function parsePositiveInteger(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

async function runScheduledJob(event: ScheduledController, env: Env, config: ScheduledJobConfig): Promise<void> {
  await trackSchedulerRun(
    env.SCHEDULER_STATUS_BUCKET,
    {
      jobKey: config.jobKey,
      triggerType: "cron",
      triggerLabel: config.cron,
      scheduledFor: toScheduledForIso(event.scheduledTime)
    },
    async () => {
      await config.handler(event, config.env);
      return null;
    }
  );
}

async function dispatchModule(request: Request, pathname: string, handler: FetchHandler, env: unknown): Promise<Response> {
  const nextPathname = pathname || "/";
  return handler(rewriteRequest(request, nextPathname), env);
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/" || pathname === "/api/v1" || pathname === "/api/v1/") {
      return createJsonResponse({
        ok: true,
        service: "market-dailies-api",
        routes: {
          health: "/api/v1/health",
          assets: "/api/v1/assets",
          status: "/api/v1/status/scheduler",
          stocks: "/api/v1/stocks/*",
          crypto: "/api/v1/crypto/*"
        }
      });
    }

    if (pathname === "/health" || pathname === "/api/v1/health") {
      return createJsonResponse({
        ok: true,
        service: "market-dailies-api",
        assets: ASSET_ITEMS
      });
    }

    if (pathname === "/api/v1/assets") {
      return createJsonResponse({ items: ASSET_ITEMS });
    }

    if (pathname === "/api/v1/status/scheduler") {
      const recentLimit = parsePositiveInteger(url.searchParams.get("limit"), 20, 1, 100);
      return createJsonResponse(await readSchedulerStatus(env.SCHEDULER_STATUS_BUCKET, recentLimit));
    }

    if (pathname.startsWith("/api/v1/stocks")) {
      const subPath = pathname.replace(/^\/api\/v1\/stocks/, "") || "/";
      return dispatchModule(request, subPath, stocksModule.fetch as FetchHandler, toStocksEnv(env));
    }

    if (pathname.startsWith("/api/v1/crypto")) {
      const subPath = pathname.replace(/^\/api\/v1\/crypto/, "") || "/";
      return dispatchModule(request, subPath, cryptoModule.fetch as FetchHandler, toCryptoEnv(env));
    }

    return createJsonResponse(
      {
        ok: false,
        error: "not_found",
        message: "Unknown API route."
      },
      404
    );
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    if (event.cron === STOCKS_CRON) {
      await runScheduledJob(event, env, {
        cron: STOCKS_CRON,
        jobKey: "stocks_daily_report",
        handler: stocksModule.scheduled as ScheduledHandler,
        env: toStocksEnv(env)
      });
      return;
    }

    if (event.cron === MARKET_INDICES_SUMMARY_CRON_DST || event.cron === MARKET_INDICES_SUMMARY_CRON_STD) {
      await runScheduledJob(event, env, {
        cron: event.cron,
        jobKey: "market_indices_summary",
        handler: stocksModule.scheduled as ScheduledHandler,
        env: toStocksEnv(env)
      });
      return;
    }

    if (event.cron === CRYPTO_NEWS_CRON) {
      await runScheduledJob(event, env, {
        cron: CRYPTO_NEWS_CRON,
        jobKey: "crypto_news_ingestion",
        handler: cryptoModule.scheduled as ScheduledHandler,
        env: toCryptoEnv(env)
      });
      return;
    }

    if (event.cron === CRYPTO_CRON) {
      await runScheduledJob(event, env, {
        cron: CRYPTO_CRON,
        jobKey: "crypto_daily_report",
        handler: cryptoModule.scheduled as ScheduledHandler,
        env: toCryptoEnv(env)
      });
      return;
    }

    console.warn(`[SCHEDULED] Unhandled cron trigger: ${event.cron}`);
  }
};
