# China Stocks Daily Worker

Cloudflare Worker (Hono.js) that generates a daily China ADR markdown report.

## What it does

- Pulls daily price data from Yahoo Finance for KWEB top-10 holdings only.
- Pulls related news from Google News RSS.
- Generates markdown report with:
  - AI market overview (OpenAI-compatible API, e.g. maxx)
  - full stock data table
  - per-company news links
- Runs on cron trigger and can also be called manually via HTTP.
- OpenAPI schema is generated from route annotations via `hono-openapi`.

## Endpoints

- `GET /health`: health check
- `GET /run`: generate report immediately and return markdown
- `GET /latest`: return latest report (D1 first, fallback to R2)
- `GET /reports?limit=30&cursor=<cursor>`: list report history with pagination (D1 first, fallback to R2)
- `GET /report/:date`: read report by date from D1 first, then R2; if date is today (ET) and missing, it auto-generates on demand
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

## Optional configuration

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

### Custom stock metadata (KWEB top-10 only)

Set `STOCK_LIST_JSON` as a Wrangler secret or variable to override display name/aliases for KWEB top-10 symbols only.
Symbols outside the KWEB top-10 set are ignored. Format:

```json
[
  { "symbol": "9988.HK", "name": "Alibaba Group", "aliases": ["阿里巴巴", "阿里"] }
]
```

You can also use `.dev.vars` locally. A template is provided in `.dev.vars.example`.

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

If `OPENAI_BASE_URL` is configured, the worker will:
- generate one market overview summary (max 200 Chinese chars)

## Cron

Current cron in `wrangler.toml`:

- `45 23 * * 1-5` (UTC weekdays)

Adjust this based on your preferred publish time.
