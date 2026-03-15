# Repository Guidelines

## Project Structure & Module Organization
This is a Bun workspace monorepo:
- `apps/api`: Cloudflare Worker backend (Hono + Drizzle) under `src/modules/{stocks,crypto}`.
- `apps/web`: Vinext/Next frontend (`app/`, `components/`, `lib/`) plus worker proxy code in `worker/index.ts`.
- `packages/contracts`: shared TypeScript contracts.
- `tests`: root tests for API routes, schedulers, contracts, and web loaders.
- `scripts`: workspace helpers (for example config switching and D1 sync).

## Build, Test, and Development Commands
Run from repo root:
- `bun install`: install workspace dependencies.
- `bun run dev:api`: start API worker via Wrangler.
- `bun run dev:web`: start web app in local config mode.
- `bun run check`: run TypeScript checks for API and web.
- `bun run test`: execute the curated Bun test suite in `tests/`.
- `bun run build`: build `apps/web` for deployment.
- `bun run deploy:api` / `bun run deploy:web`: deploy workers.

## Coding Style & Naming Conventions
- Language: strict TypeScript (`tsconfig.base.json` has `"strict": true`).
- Formatting in existing code: 2-space indentation, double quotes, semicolons.
- Components/types: `PascalCase`; helper modules: kebab-case files (for example `platform-status-core.ts`).
- Route files follow Next conventions (for example `apps/web/app/[lang]/stocks/report/[date]/page.tsx`).
- UI implementation should prefer `shadcn/ui` primitives from `apps/web/components/ui` before introducing custom base components.
- Data access in `apps/api` should prefer Drizzle ORM (schema + query builder) over handwritten SQL; keep raw SQL only for cases ORM cannot express clearly.
- Prefer shared contracts from `packages/contracts` over duplicated types.

## Testing Guidelines
- Test runner is Bun (`bun test`), using `node:test` + `assert` patterns.
- Add tests in `tests/*.test.ts`; mirror domain naming (`api.*.test.ts`, `web.*.test.ts`).
- Keep external I/O mocked/stubbed in tests; avoid live network dependencies.
- Frontend validation should use Agent Browser for end-to-end checks (navigation, forms, locale routes, screenshots).
  Example: `bun run dev:web` -> `agent-browser open http://127.0.0.1:3000/zh` -> `agent-browser snapshot -i` -> `agent-browser screenshot`.
- Before opening a PR, run: `bun run check && bun run test`.

## Commit & Pull Request Guidelines
- Follow the repository’s established style: Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `chore:`).
- Use concise, imperative subjects and scope by area when useful (example: `feat(api): add crypto news admin trigger`).
- PRs should include: purpose, key changes, validation commands run, linked issue/context, and UI screenshots for `apps/web` changes.

## Security & Configuration Tips
- Never commit secrets. Use Cloudflare secrets/vars for tokens and API keys.
- Keep environment-specific endpoints in Wrangler config (`apps/api/wrangler.toml`, `apps/web/wrangler*.jsonc`), not hardcoded in source.
