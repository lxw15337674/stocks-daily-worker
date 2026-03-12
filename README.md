# Market Daily Monorepo

Monorepo for a unified multi-asset daily report platform on Cloudflare.

## Workspace Layout

- `apps/api`: unified Hono + Cloudflare Worker backend exposing `/api/v1/stocks/*` and `/api/v1/crypto/*`
- `apps/web`: unified vinext + shadcn/ui frontend with localized routes under `/{lang}`
- `packages/contracts`: shared stock contracts used across the workspace

The repository uses `pnpm workspace` only. There is no `turbo` layer.

## What it does

- Serves one platform shell for stocks and crypto today, with room for gold and bonds later.
- Keeps stocks and crypto as internal modules while deploying one backend worker and one frontend worker.
- Generates stock daily reports with archive/admin flows and crypto daily reports with archive/detail flows.
- Uses path-based i18n on the frontend (`/{lang}/...`) and a shared platform header with asset switching.

## API Surface

- `GET /api/v1/health`: unified health check
- `GET /api/v1/assets`: enabled/disabled asset registry
- `GET /api/v1/stocks/*`: legacy stock API mounted under the stocks namespace
- `GET /api/v1/crypto/*`: crypto API mounted under the crypto namespace
- The web worker also preserves legacy stock-style `/api/*` paths and proxies `/api/crypto/*` to the unified backend

## Setup

1. Login Cloudflare from the repo root:

```bash
pnpm run cf:login
```

2. Install dependencies from the workspace root:

```bash
pnpm install
```

3. Create D1 databases (first time):

```bash
pnpm run cf:d1:create:stocks
pnpm run cf:d1:create:crypto
```

Then update `apps/api/wrangler.toml` with the returned `database_id` values.

4. Local API dev:

```bash
pnpm dev:api
```

5. Local web dev:

```bash
pnpm dev:web
```

6. Deploy:

```bash
pnpm deploy:api
pnpm deploy:web
```

7. Verify:

```bash
curl https://<your-api-worker>.workers.dev/api/v1/health
curl https://<your-api-worker>.workers.dev/api/v1/assets
curl https://<your-web-worker>.workers.dev/zh
```

## Cloudflare Git Auto Deploy

Use Cloudflare native Git integration (Workers Builds) for auto build/deploy on commit.

Recommended setup for this monorepo:

- Backend Worker project
  - Root Directory: `/`
  - Build Command: `pnpm install --frozen-lockfile`
  - Deploy Command: `pnpm --filter @china-stocks/api run deploy`
  - Production Branch: `main`
- Frontend Worker project
  - Root Directory: `/`
  - Build Command: `pnpm install --frozen-lockfile`
  - Deploy Command: `pnpm --filter @china-stocks/web run deploy`
  - Production Branch: `main`

When configured, commits pushed to `main` will trigger Cloudflare auto deploy directly.

Legacy compatibility note:

- If an existing frontend Worker Build project still uses `Root Directory: /web`, this repo now includes a thin `web/` compatibility wrapper so the old setting can still deploy `apps/web`.
- If that legacy project also still uses `Deploy Command: pnpm deploy`, change it to `pnpm run deploy` because `pnpm@10` reserves `deploy` as a built-in CLI command.
- The preferred long-term Cloudflare configuration remains `Root Directory: /`.

## Optional configuration

### Website frontend (vinext + shadcn/ui)

The web UI project is under `apps/web` and supports date lookup pages.

```bash
pnpm dev:web
```

### Stocks D1 + Crypto D1

Bind D1 in `apps/api/wrangler.toml` (replace with your values):

```toml
[[d1_databases]]
binding = "STOCKS_DB"
database_name = "china-stocks-daily"
database_id = "<stocks-d1-database-id>"

[[d1_databases]]
binding = "CRYPTO_DB"
database_name = "crypto-daily"
database_id = "<crypto-d1-database-id>"
```

When the stock DB is configured, each stock run stores:
- structured market overview metadata (`report_runs`)
- quote snapshots (`report_quotes`)
- news items with bilingual AI summary (`report_news`)

### Stock Pool Management (D1 + Admin Token)

Stock pool is now stored in D1 table `stocks`.
On first startup, default stocks are automatically seeded if the table is empty.

Set `STOCKS_ADMIN_TOKEN` for stock admin APIs and `CRYPTO_ADMIN_TOKEN` for crypto admin/manual run APIs.
This Worker uses Cloudflare Worker Versions, so use versioned secret commands:

```bash
pnpm exec wrangler versions secret put STOCKS_ADMIN_TOKEN --config apps/api/wrangler.toml
pnpm exec wrangler versions secret put CRYPTO_ADMIN_TOKEN --config apps/api/wrangler.toml
pnpm exec wrangler versions deploy <new-version-id>@100 --yes --config apps/api/wrangler.toml
```

Admin endpoints require header:

```http
x-admin-token: <STOCKS_ADMIN_TOKEN or CRYPTO_ADMIN_TOKEN>
```

For local development, prefer a non-committed `apps/api/.dev.vars` file or `pnpm exec wrangler dev --config apps/api/wrangler.toml --var CRYPTO_ADMIN_TOKEN:...`.

Web frontend provides the stock admin UI at `/{lang}/stocks/admin`.

### Push result to webhook

Set `STOCKS_WEBHOOK_URL` if you want stock report push delivery. The worker posts JSON payload:

```json
{
  "reportDateEt": "2026-03-05",
  "createdAt": "2026-03-06T03:00:00.000Z",
  "sampleSize": 12,
  "validQuoteCount": 12
}
```

### AI summary via OpenAI-compatible API

Set the stock-prefixed vars/secrets:

- `STOCKS_OPENAI_BASE_URL` example:
  - `https://maxx.cloverstd.com`
  - If you pass only host/base path, worker auto-completes to `/v1/chat/completions`
- `STOCKS_OPENAI_API_KEY`: API key for the provider
- `STOCKS_AI_MODEL`: optional, default `gpt-5.2`
- `STOCKS_NEWS_BODY_FETCH_ENABLED`: optional, default `true`
- `STOCKS_NEWS_BODY_PER_STOCK_LIMIT`: optional, default `2`
- `STOCKS_NEWS_BODY_TIMEOUT_MS`: optional, default `4500`
- `STOCKS_NEWS_BODY_MAX_CHARS`: optional, default `900`
- `CRYPTO_AI`: Workers AI binding used by the crypto module

If `OPENAI_BASE_URL` is configured, the worker will:
- generate one market overview summary (max 200 Chinese chars)
- generate per-stock news summaries persisted into `report_news.ai_summary`
- auto-generate stock aliases for stock CRUD operations

## Cron

Current cron in `apps/api/wrangler.toml`:

- `0 23 * * 1-5` (UTC Monday-Friday, equals 07:00 Asia/Shanghai Tuesday-Saturday, covering Monday-Friday ET trading days)

The scheduled task requires D1 binding and will fail fast if `DB` is not configured.
