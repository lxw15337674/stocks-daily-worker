# China Stocks Daily Web (vinext + shadcn/ui)

This folder contains the website frontend built with `vinext` (Next.js API on Vite) and `shadcn/ui`.

<!-- trigger: cloudflare web auto build -->

## Features

- Home dashboard with latest summary and feed links
- Date lookup (`YYYY-MM-DD`) and report detail page
- Archive page listing historical reports
- Stock admin page (`/stocks`) for CRUD and AI alias regeneration (requires `ADMIN_TOKEN`)
- Markdown rendering for full report content

## Commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm deploy
```

## API Base URL

Set `STOCKS_API_BASE_URL` in `wrangler.jsonc` if the API worker uses a different domain.

Default:

```json
"STOCKS_API_BASE_URL": "https://china-stocks-daily-worker.404174262.workers.dev"
```

