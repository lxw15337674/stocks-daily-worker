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
bun run dev:web
bun run check:web
bun run deploy:web
```

From this directory:

```bash
bun run dev
bun run check
bun run build
bun run deploy
```

`bun run deploy` now builds locally and then calls Wrangler via
`bunx wrangler`, so Cloudflare CLI usage stays centralized at the
workspace root.

## Environment Config

Web runtime config is now split explicitly between local and remote modes.

- `wrangler.local.jsonc` + `lib/runtime-config.local.ts` are used for local development
- `wrangler.remote.jsonc` + `lib/runtime-config.remote.ts` are used for build/deploy
- `wrangler.jsonc` + `lib/runtime-config.ts` are the active generated copies switched by `bun ../../scripts/select-web-config.ts <local|remote>`

The important behavioral rule is:

- browser requests may still use same-origin `/api/*` proxy paths
- SSR always uses the configured API origin from `runtime-config.ts` and no longer infers production targets from the current host

