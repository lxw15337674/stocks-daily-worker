# China Stocks Daily Worker

Cloudflare Worker (Hono.js) that generates a daily China ADR markdown report.

## What it does

- Pulls daily price data from Yahoo Finance for KWEB top-10 default constituents (configurable).
- Pulls related news from Google News RSS.
- Generates markdown report with:
  - market overview
  - top gainers
  - top losers
  - per-company news links
- Runs on cron trigger and can also be called manually via HTTP.

## Endpoints

- `GET /health`: health check
- `GET /run`: generate report immediately and return markdown
- `GET /latest`: return latest report (D1 first, fallback to R2)
- `GET /report/:date`: read report by date from D1 first, then R2; if date is today (ET) and missing, it auto-generates on demand
- `GET /openapi.json`: OpenAPI 3.1 JSON schema for all endpoints
- `GET /docs`: interactive API docs (Swagger UI)

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
curl https://<your-worker>.workers.dev/docs
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

### Custom stock universe

Set `STOCK_LIST_JSON` as a Wrangler secret or variable. Format:

```json
[
  { "symbol": "BABA", "name": "Alibaba", "aliases": ["阿里", "阿里巴巴"] }
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

### AI Gateway summary

Set these secrets/vars for Cloudflare AI Gateway (OpenAI-compatible endpoint):

- `AI_GATEWAY_BASE_URL` example:
  - `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/openai/chat/completions`
- `AI_API_KEY`: upstream provider key passed through gateway (if required)
- `AI_MODEL`: optional, default is `@cf/zai-org/glm-4.7-flash`

If `AI_GATEWAY_BASE_URL` is configured, the worker will:
- summarize each stock's news into one Chinese sentence
- generate one market overview sentence for the report

### Use Cloudflare native AI directly (recommended)

In `wrangler.toml`:

```toml
[ai]
binding = "AI"
```

With this binding, the worker calls Cloudflare Workers AI directly (default: `@cf/zai-org/glm-4.7-flash`) and does not require external API keys.
If direct AI call fails, it can still fall back to AI Gateway config when provided.

## Cron

Current cron in `wrangler.toml`:

- `45 23 * * 1-5` (UTC weekdays)

Adjust this based on your preferred publish time.
