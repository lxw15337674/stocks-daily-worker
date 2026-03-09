# China Stocks Daily Worker

Cloudflare Worker (Hono.js) that generates a daily China ADR markdown report.

## What it does

- Pulls daily price data from Yahoo Finance for China ADR stocks.
- Pulls related news from Google News RSS.
- Generates markdown report with:
  - AI market overview (OpenAI-compatible API, e.g. maxx)
  - full stock data table
  - per-company news links
- Runs on cron trigger and can also be called manually via HTTP.
- OpenAPI schema is generated from route annotations via `hono-openapi`.

## Endpoints

- `GET /health`: health check
- `GET /run`: generate report immediately and return markdown (requires `x-admin-token`)
- `GET /latest`: return latest report (D1 first, fallback to R2)
- `GET /reports?limit=30&cursor=<cursor>`: list report history with pagination (D1 first, fallback to R2)
- `GET /stocks`: list stock pool (`?includeInactive=true` requires `x-admin-token`)
- `POST /stocks`: create stock (requires `x-admin-token`, auto-generate aliases by AI)
- `PUT /stocks/:id`: update stock (requires `x-admin-token`, auto-regenerate aliases)
- `DELETE /stocks/:id`: soft-delete stock (requires `x-admin-token`)
- `POST /stocks/:id/aliases/regenerate`: regenerate aliases for one stock (requires `x-admin-token`)
- `GET /report/:date`: read report by date from D1 first, then R2; if date is today (ET) and missing, it auto-generates on demand (requires `x-admin-token`)
- `GET /rss.xml?limit=30`: RSS 2.0 feed for latest reports with full markdown content in each item (D1 first, fallback to R2)
- `GET /atom.xml?limit=30`: Atom 1.0 feed for latest reports (D1 first, fallback to R2)
- `GET /feed.json?limit=30`: JSON Feed for latest reports (D1 first, fallback to R2)
- `GET /openapi.json`: OpenAPI 3.1 JSON schema for all endpoints
- `GET /`: interactive API docs (Swagger UI)
- `GET /docs`: interactive API docs alias (backward compatible)

## Setup

1. Login Cloudflare:

```bash
npx wrangler login
```

2. Install dependencies:

```bash
npm install
```

3. Create D1 database (first time):

```bash
npx wrangler d1 create china-stocks-daily
```

Then update `wrangler.toml` with returned `database_id`.

4. Local dev:

```bash
npm run dev
```

5. Deploy:

```bash
npm run deploy
```

6. Verify:

```bash
curl https://<your-worker>.workers.dev/health
curl https://<your-worker>.workers.dev/
```

## Cloudflare Git Auto Deploy

Use Cloudflare native Git integration (Workers Builds) for auto build/deploy on commit.

Recommended setup for this monorepo:

- Backend Worker project
  - Root Directory: `/`
  - Build Command: `npm ci`
  - Deploy Command: `npx wrangler deploy --config wrangler.toml`
  - Production Branch: `main`
- Frontend Worker project
  - Root Directory: `/web`
  - Build Command: `corepack enable && pnpm install --frozen-lockfile`
  - Deploy Command: `pnpm deploy`
  - Production Branch: `main`

When configured, commits pushed to `main` will trigger Cloudflare auto deploy directly.

## Optional configuration

### Website frontend (vinext + shadcn/ui)

The web UI project is under `web/` and supports date lookup pages.

```bash
cd web
pnpm install
pnpm dev
```

### Persist reports to D1

Bind D1 in `wrangler.toml` (replace with your values):

```toml
[[d1_databases]]
binding = "DB"
database_name = "china-stocks-daily"
database_id = "<your-d1-database-id>"
```

When `DB` is configured, each run stores:
- report markdown and market overview (`report_runs`)
- quote snapshots (`report_quotes`)
- news items with AI summary (`report_news`)

### Stock Pool Management (D1 + Admin Token)

Stock pool is now stored in D1 table `stocks`.
On first startup, default stocks are automatically seeded if the table is empty.

Set `ADMIN_TOKEN` (Wrangler secret or variable) for protected APIs:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Admin endpoints require header:

```http
x-admin-token: <ADMIN_TOKEN>
```

Web frontend provides `/stocks` page for CRUD and alias regeneration.

### Archive markdown to R2

Add this block to `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "REPORT_BUCKET"
bucket_name = "china-stocks-daily"
```

### Push result to webhook

Set `WEBHOOK_URL` secret. The worker posts JSON payload:

```json
{
  "fileName": "china-stocks-daily-2026-03-05.md",
  "markdown": "# 中概日报 ..."
}
```

### AI summary via OpenAI-compatible API

Set these vars/secrets:

- `OPENAI_BASE_URL` example:
  - `https://maxx.cloverstd.com`
  - If you pass only host/base path, worker auto-completes to `/v1/chat/completions`
- `OPENAI_API_KEY`: API key for the provider
- `AI_MODEL`: optional, default `gpt-5.2`
- `NEWS_BODY_FETCH_ENABLED`: optional, default `true`; when enabled, worker fetches article body snippets and feeds them to AI prompts
- `NEWS_BODY_PER_STOCK_LIMIT`: optional, default `2`; max number of article bodies fetched per stock (0-5)
- `NEWS_BODY_TIMEOUT_MS`: optional, default `4500`; timeout per body fetch request in milliseconds
- `NEWS_BODY_MAX_CHARS`: optional, default `900`; retained chars per body snippet (120-3000)

If `OPENAI_BASE_URL` is configured, the worker will:
- generate one market overview summary (max 200 Chinese chars)
- generate per-stock news summaries persisted into `report_news.ai_summary`
- auto-generate stock aliases for stock CRUD operations

## Cron

Current cron in `wrangler.toml`:

- `0 23 * * 1-5` (UTC Monday-Friday, equals 07:00 Asia/Shanghai Tuesday-Saturday, covering Monday-Friday ET trading days)

The scheduled task requires D1 binding and will fail fast if `DB` is not configured.
