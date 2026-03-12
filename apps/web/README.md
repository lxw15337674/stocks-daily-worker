# Market Daily Web (vinext + shadcn/ui)

This folder contains the website frontend built with `vinext` (Next.js API on Vite) and `shadcn/ui`.
It now lives inside the workspace monorepo at `apps/web`.

<!-- trigger: cloudflare web auto build -->

## Features

- Unified localized shell under `/{lang}` with shared top header
- Asset switcher for stocks and crypto, designed to extend to gold and bonds
- Stocks channel with home, archive, compare, instrument, and admin pages
- Crypto channel with home, archive, report detail, and instrument pages
- Worker-side API proxy for legacy stocks routes, crypto routes, and direct `/api/v1/*`

## Commands

From the repository root:

```bash
pnpm dev:web
pnpm check:web
pnpm deploy:web
```

From this directory:

```bash
pnpm dev
pnpm check
pnpm build
pnpm deploy
```

`pnpm deploy` now builds locally and then calls the repository-root Wrangler via
`pnpm --dir ../.. exec wrangler`, so Cloudflare CLI usage stays centralized at the
workspace root.

## API Base URL

Set `MARKETS_API_BASE_URL` in `wrangler.jsonc` if the unified API worker uses a different domain.

Default:

```json
"MARKETS_API_BASE_URL": "https://china-stocks-daily-worker.404174262.workers.dev"
```

