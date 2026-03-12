# Global Market Indices Feature Design

## Goal

Add a global market indices layer to the existing stocks channel so users can see broad market context for CN, HK, and US markets alongside the current stock report workflow.

This is a stocks-channel feature, not a new standalone asset channel.

## Repo Fit

The current repository already has:

- a unified API worker under `apps/api/src/index.ts`
- a stocks module mounted at `/api/v1/stocks/*`
- a stocks D1 database bound as `STOCKS_DB`
- a localized stocks web app under `apps/web/app/[lang]/stocks/*`
- an existing Yahoo quote fetch path in `apps/api/src/modules/stocks/app.ts`

The design should extend those pieces instead of introducing a parallel stack.

## Scope

Phase 1 covers:

- latest quote snapshot for a fixed set of global indices
- daily history persistence for charting
- a compact "Market Pulse" block on the stocks home page
- a dedicated market page for historical comparison
- manual/admin sync plus scheduled syncs

Phase 1 does not cover:

- index constituent breadth
- macro event overlays
- AI narrative for indices
- a separate platform-home module

## Tracked Universe

### US

- S&P 500: `^GSPC`
- Nasdaq Composite: `^IXIC`
- Dow Jones Industrial Average: `^DJI`

### HK

- Hang Seng Index: `^HSI`
- Hang Seng Tech Index: `^HSTECH`

### CN

- SSE Composite: `000001.SS`
- CSI 300: `000300.SH`
- SZSE Component: `399001.SZ`

Each index should also have a stable internal key, for example:

- `us_sp500`
- `us_nasdaq`
- `us_dow`
- `hk_hsi`
- `hk_hstech`
- `cn_sse`
- `cn_csi300`
- `cn_szse`

Do not use the Yahoo symbol as the only primary identifier in the app layer.

## Data Source Strategy

Do not introduce `yahoo-finance2` for Phase 1.

Reason:

- the current stocks module already fetches Yahoo chart data over plain HTTP
- that approach is Worker-safe and consistent with the existing runtime model
- adding a Node-oriented finance library increases compatibility risk in Cloudflare Workers without solving a current gap

Phase 1 should reuse the same Yahoo chart endpoint pattern already used for stock quotes:

- latest snapshot: `v8/finance/chart/:symbol?interval=1d&range=...`
- historical bars: same endpoint with `range=1mo|3mo|1y` and daily interval

Wrap this in a dedicated helper under the stocks indices module so it does not stay embedded inside `app.ts`.

## Data Model

The feature should live in the existing `STOCKS_DB`.

### Table: `market_indices`

Purpose:

- registry for supported indices
- latest known quote snapshot
- display metadata for region-aware rendering

Suggested columns:

- `id`
- `index_key` unique
- `symbol` unique
- `region` enum-like text: `cn | hk | us`
- `name_zh`
- `name_en`
- `display_order`
- `is_primary` boolean
- `currency`
- `market_timezone`
- `price`
- `previous_close`
- `change_pct`
- `change_abs`
- `quote_timestamp`
- `source`
- `created_at`
- `updated_at`

Suggested unique/index constraints:

- unique `index_key`
- unique `symbol`
- index `(region, display_order)`
- index `(is_primary, region)`

### Table: `market_index_history`

Purpose:

- daily history for charts and normalized comparison

Suggested columns:

- `id`
- `index_key`
- `trading_date`
- `close`
- `previous_close`
- `change_pct`
- `change_abs`
- `currency`
- `source`
- `observed_at`
- `created_at`

Suggested constraints:

- unique `(index_key, trading_date)`
- index `(index_key, trading_date desc)`

### Drizzle placement

Add the schema to:

- `apps/api/src/modules/stocks/schema.ts`

and export typed row models for later reuse in contracts and API serialization.

## API Design

All routes should follow the current unified prefix:

- `/api/v1/stocks/*`

The routes named in the original concept doc should be corrected accordingly.

### Public endpoints

#### `GET /api/v1/stocks/indices/latest`

Returns:

- grouped CN/HK/US market pulse cards
- all tracked indices with latest quote fields
- last sync timestamps

Suggested response shape:

```ts
type MarketIndexLatestItem = {
  indexKey: string;
  symbol: string;
  region: "cn" | "hk" | "us";
  name: { zh: string; en: string };
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  changeAbs: number | null;
  currency: string | null;
  quoteTimestamp: string | null;
  isPrimary: boolean;
};

type MarketIndexLatestResponse = {
  updatedAt: string | null;
  regions: Array<{
    region: "cn" | "hk" | "us";
    primaryIndexKey: string;
    items: MarketIndexLatestItem[];
  }>;
};
```

#### `GET /api/v1/stocks/indices/history`

Use a query-based endpoint instead of one-symbol-per-route for the main comparison screen.

Suggested query params:

- `symbols` or `indexKeys`
- `range=1m|3m|1y`

Returns:

- daily points for each requested index
- enough data for normalized line charts

#### `GET /api/v1/stocks/indices/:indexKey/history`

Optional convenience endpoint for a single-card detail drill-down.

### Admin endpoints

#### `GET /api/v1/stocks/indices/admin/run`

Protected by `STOCKS_ADMIN_TOKEN`.

Use for:

- manual latest sync
- manual historical backfill for the tracked universe

Suggested query params:

- `mode=latest|history|full`
- `range=1m|3m|1y`

This matches the existing manual-run pattern already used by stocks and crypto.

## Worker Module Layout

Add:

- `apps/api/src/modules/stocks/indices.ts`

Responsibility:

- tracked index registry
- Yahoo fetch helpers for indices
- latest sync logic
- history sync logic
- D1 upsert/query helpers
- DTO builders for API responses

Keep `apps/api/src/modules/stocks/app.ts` as the route composition layer.

Phase 1 route wiring in `app.ts`:

- `/indices/latest`
- `/indices/history`
- `/indices/:indexKey/history`
- `/indices/admin/run`

## Synchronization Strategy

### Important constraint

Cloudflare cron is UTC-based and does not automatically follow U.S. DST.

So the original doc's "04:15 Beijing / 16:15 ET" phrasing is not enough for implementation.

### Proposed Phase 1 cron plan

Keep the existing stock report cron unchanged.

Add three new index-focused sync windows:

- `15 8 * * 1-5`
  - CN/HK close sync
  - captures roughly 16:15 Asia/Shanghai / Hong Kong

- `20 20 * * 1-5`
  - US close sync for DST months

- `20 21 * * 1-5`
  - US close sync for standard-time months

The handler should:

- check market region and effective local close state
- skip if the run is not applicable for that market/day
- upsert by `(index_key, trading_date)` so duplicate close-window runs stay safe

### Optional intra-day refresh

Do not implement in Phase 1.

Reason:

- latest endpoint can fall back to current upstream fetch if the stored snapshot is stale
- adding a high-frequency cron expands operational cost and failure surface before the page proves value

If needed in Phase 1.5, add:

- a lightweight snapshot refresh path without historical writes
- optional cache/KV layer only for latest cards

## Frontend Design

### Placement

The current repo has two possible "homepages":

- platform home: `/{lang}`
- stocks channel home: `/{lang}/stocks`

Phase 1 should land in the stocks channel home, not the platform home.

Reason:

- it is directly relevant to stock context
- it avoids crowding the cross-asset landing page
- it can reuse existing stocks fetch/layout patterns immediately

### New stocks page

Add:

- `/{lang}/stocks/market`

Use it as the dedicated market comparison page.

### Components

Add:

- `apps/web/components/stocks/market-status-grid.tsx`
- `apps/web/components/stocks/index-chart.tsx`
- `apps/web/components/stocks/pages/market-page.tsx`

Responsibilities:

- `market-status-grid.tsx`
  - renders CN/HK/US cards
  - highlights the primary index for each region

- `index-chart.tsx`
  - normalized multi-line chart
  - range switcher: `1M`, `3M`, `1Y`

- `market-page.tsx`
  - page composition
  - summary cards
  - chart
  - latest snapshot list

### Route wiring

Add:

- `apps/web/app/[lang]/stocks/market/page.tsx`

Update route helpers in:

- `apps/web/lib/platform-routes.ts`

to include a helper such as:

- `stocksMarketPath(lang)`

### Data fetch layer

Extend:

- `apps/web/lib/api.ts`

with:

- `fetchStockIndicesLatest()`
- `fetchStockIndicesHistory(indexKeys, range)`

### I18n

Extend:

- `apps/web/lib/i18n.ts`

Add copy for:

- page title/subtitle
- region names
- index labels
- market pulse section labels
- chart range labels
- freshness labels

Do not hardcode index labels in components.

## Visual Rules

Region color conventions should be explicit.

### CN/HK cards

- red = up
- green = down

### US cards

- green = up
- red = down

This means the app needs a small display utility, not one global "positive is red" assumption.

## Contracts

Extend:

- `packages/contracts/src/index.ts`

Add typed payloads for:

- latest indices response
- history response
- market range values
- region keys

This keeps API worker and web worker aligned.

## Delivery Plan

### Slice 1: Data foundation

- add Drizzle schema for indices + history
- add tracked index registry
- add D1 ensure-schema path
- add Yahoo fetch helpers

### Slice 2: Read APIs

- latest endpoint
- history endpoint
- contracts update
- basic unit/shape validation

### Slice 3: Manual sync

- admin run endpoint
- full and latest modes
- D1 upsert logic

### Slice 4: Scheduled sync

- add cron entries to `apps/api/wrangler.toml`
- wire new scheduled handler branches
- ensure idempotent reruns

### Slice 5: Web UI

- market pulse block on `/{lang}/stocks`
- dedicated `/{lang}/stocks/market`
- range selector and normalized chart

## Open Questions

### 1. Latest endpoint read path

Two valid choices:

- always read from D1 only
- read from D1 first, then fall back to live upstream fetch if stale

Recommendation:

- Phase 1 public endpoint returns D1-backed data only
- manual/admin sync and scheduled sync keep freshness acceptable

This keeps response latency predictable and avoids upstream failures on every page view.

### 2. History range

The doc says "1Y+".

Recommendation:

- store at least 1 year on first rollout
- expose `1m`, `3m`, `1y`
- leave longer windows for Phase 2

### 3. Breadth

The original doc mentions advance/decline breadth "if data allows".

Recommendation:

- do not implement constituent breadth in Phase 1
- if a simple breadth metric is needed, define it only across the tracked index set and label it clearly as index breadth, not market breadth

## Recommended First Implementation Ticket

Start with backend-only foundation:

1. add `market_indices` and `market_index_history` schema to the stocks module
2. add `apps/api/src/modules/stocks/indices.ts`
3. implement `GET /api/v1/stocks/indices/latest`
4. implement `GET /api/v1/stocks/indices/admin/run?mode=full&range=1y`
5. update `packages/contracts/src/index.ts`

That gives a stable backend surface before charting and UI work begin.
