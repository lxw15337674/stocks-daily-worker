# Repository Guidelines

## Project Structure & Module Organization
This workspace is a Bun monorepo. The web app lives in `apps/web`, the API worker in `apps/api`, shared contracts in `packages/contracts`, and shared tests in `tests/`. Inside `apps/web`, routes live under `app/`, reusable UI under `components/`, helpers under `lib/`, and the Cloudflare proxy in `worker/index.ts`. Treat `dist/` as generated output.

## Build, Test, and Development Commands
Prefer running commands from the repository root:

```bash
pnpm dev:web         # start the web app in vinext dev mode
pnpm check:web       # run vinext type checks and TypeScript
pnpm test            # run the shared test suite in /tests
pnpm deploy:web      # build apps/web and deploy with Wrangler
```

From `apps/web`, the equivalent commands are `pnpm dev`, `pnpm check`, `pnpm build`, and `pnpm deploy`.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation, double quotes, and semicolons. Exported React components and page modules use PascalCase, helper files in `lib/` use kebab-case, and route folders follow patterns such as `app/[lang]/stocks/report/[date]/page.tsx`. Keep Tailwind utilities close to the component and use the `@/` alias for internal imports. Prefer existing `components/ui/*` shadcn primitives before adding custom widgets.

## Rendering & Data Access Preferences
Default to SSR and server components for pages, loaders, and route-level data fetching. Add `"use client"` only when interactivity, browser APIs, or local state make it necessary, and keep client boundaries as small as possible. On the backend, prefer Drizzle ORM in `apps/api` for schema, queries, and migrations; fall back to raw SQL only when Drizzle cannot express the operation cleanly.

## Testing Guidelines
Tests are invoked with `pnpm test` and use Bun's test runner under the hood, not Jest or Vitest. Add coverage in `tests/*.test.ts` and name cases with explicit behavior statements, for example `test("loadMarketPageData drives market page server fetches", ...)`. Favor small unit tests around loaders, parsers, and shared contracts.

## Commit & Pull Request Guidelines
Recent history favors short imperative subjects, usually Conventional Commit style: `feat:`, `fix:`, `refactor:`, and `chore:`. Keep each commit focused and mention the affected area when helpful, for example `feat: add localized crypto archive filters`. Pull requests should include a brief summary, linked issue or context, commands run (`pnpm check:web`, `pnpm test`), and screenshots for UI changes.

## Configuration Tips
Runtime API settings are configured through `apps/web/wrangler.jsonc`. If the backend domain changes, update `MARKETS_API_BASE_URL` there instead of hardcoding URLs in components or loaders.
