# Repository Guidelines

## Project Structure & Module Organization
This is a pnpm workspace monorepo:
- `apps/api`: Cloudflare Worker backend (Hono + Drizzle) under `src/modules/{stocks,crypto}`.
- `apps/web`: Vinext/Next frontend (`app/`, `components/`, `lib/`) plus worker proxy code in `worker/index.ts`.
- `packages/contracts`: shared TypeScript contracts.
- `tests`: root tests for API routes, schedulers, contracts, and web loaders.
- `scripts`: workspace helpers (for example config switching and D1 sync).

## Build, Test, and Development Commands
Run from repo root:
- `pnpm install`: install workspace dependencies.
- `pnpm dev:api`: start API worker via Wrangler.
- `pnpm dev:web`: start web app in local config mode.
- `pnpm check`: run TypeScript checks for API and web.
- `pnpm test`: execute the curated test suite in `tests/`.
- `pnpm build`: build `apps/web` for deployment.
- `pnpm deploy:api` / `pnpm deploy:web`: deploy workers.

## Coding Style & Naming Conventions
- Language: strict TypeScript (`tsconfig.base.json` has `"strict": true`).
- Formatting in existing code: 2-space indentation, double quotes, semicolons.
- Components/types: `PascalCase`; helper modules: kebab-case files (for example `platform-status-core.ts`).
- Route files follow Next conventions (for example `apps/web/app/[lang]/stocks/report/[date]/page.tsx`).
- UI implementation should prefer `shadcn/ui` primitives from `apps/web/components/ui` before introducing custom base components.
- Data access in `apps/api` should prefer Drizzle ORM (schema + query builder) over handwritten SQL; keep raw SQL only for cases ORM cannot express clearly.
- Prefer shared contracts from `packages/contracts` over duplicated types.

## Testing Guidelines
- Tests are run via `pnpm test`, using Bun's test runner under the hood with `node:test` + `assert` patterns.
- Add tests in `tests/*.test.ts`; mirror domain naming (`api.*.test.ts`, `web.*.test.ts`).
- Keep external I/O mocked/stubbed in tests; avoid live network dependencies.
- Frontend validation should use Agent Browser for end-to-end checks (navigation, forms, locale routes, screenshots).
  Example: `pnpm dev:web` -> `agent-browser open http://127.0.0.1:3000/zh` -> `agent-browser snapshot -i` -> `agent-browser screenshot`.
- Before opening a PR, run: `pnpm check && pnpm test`.

## Commit & Pull Request Guidelines
- Follow the repository’s established style: Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `chore:`).
- Use concise, imperative subjects and scope by area when useful (example: `feat(api): add crypto news admin trigger`).
- PRs should include: purpose, key changes, validation commands run, linked issue/context, and UI screenshots for `apps/web` changes.

## Security & Configuration Tips
- Never commit secrets. Use Cloudflare secrets/vars for tokens and API keys.
- Keep environment-specific endpoints in Wrangler config (`apps/api/wrangler.toml`, `apps/web/wrangler*.jsonc`), not hardcoded in source.
