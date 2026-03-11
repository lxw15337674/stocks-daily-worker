# Crypto Daily Redesign Plan

## Goal

Redesign the project into a crypto daily product focused on a fixed Top 10 coin whitelist.

The new product should:

- track a fixed Top 10 coin whitelist
- use Binance Spot market data as the only market data source in V1
- store only necessary structured data in D1
- stop generating and storing markdown reports
- support Chinese and English
- generate AI market summaries in both languages with Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash`
- keep daily report reading as the primary homepage experience

## Fixed Decisions

### Whitelist source

The whitelist is fixed from Binance Spot `USDT` trading pairs, ranked by real 2025 full-year cumulative quote volume.

Ranking window:

- start: `2025-01-01T00:00:00Z`
- end: `2026-01-01T00:00:00Z`

Ranking metric:

- Binance Kline `quote asset volume`
- interpreted as annual traded value in `USDT`

Final whitelist:

1. `BTC` / `BTCUSDT`
2. `ETH` / `ETHUSDT`
3. `USDC` / `USDCUSDT`
4. `SOL` / `SOLUSDT`
5. `XRP` / `XRPUSDT`
6. `FDUSD` / `FDUSDUSDT`
7. `DOGE` / `DOGEUSDT`
8. `BNB` / `BNBUSDT`
9. `SUI` / `SUIUSDT`
10. `TRUMP` / `TRUMPUSDT`

### Data source

V1 uses Binance Spot public APIs only.

Used data:

- 24h ticker data for daily snapshots
- Klines for annual whitelist calculation
- optional short-window klines for coin detail trend support

Not included in V1:

- CoinDesk or third-party news feeds
- market cap APIs
- order book analytics
- non-Binance exchanges

### Storage rule

Store only necessary product data in D1:

- fixed coin metadata
- generated daily report records
- daily coin snapshots for the whitelist
- AI summaries in Chinese and English

Do not store:

- markdown report bodies
- full raw Binance payloads
- all-market ticker snapshots
- minute-level history unless later required

### Language support

The site supports:

- Chinese: `/zh`
- English: `/en`

Rules:

- numeric market data is shared
- UI copy is translated through dictionaries
- AI summary content is generated and stored separately for `zh` and `en`

## Product Structure

### Homepage

Primary focus remains the daily report.

Sections:

1. AI daily market overview
2. report metadata and market breadth
3. Top 10 table
4. focus movers
5. archive access

### Coin detail page

Each whitelist coin gets a detail page with:

- current static profile
- latest snapshot
- recent daily history
- latest AI report context

### Archive

History page lists daily reports by date and supports opening any saved daily report.

## Data Model

### `coins`

Static whitelist metadata.

Suggested fields:

- `id`
- `rank`
- `code`
- `pair`
- `name_zh`
- `name_en`
- `core_position_zh`
- `core_position_en`
- `annual_quote_volume_usdt`
- `is_active`
- `created_at`
- `updated_at`

### `daily_reports`

One row per generated report day.

Suggested fields:

- `id`
- `report_date`
- `summary_zh`
- `summary_en`
- `total_quote_volume_usdt`
- `up_count`
- `down_count`
- `flat_count`
- `leader_code`
- `leader_change_24h_pct`
- `generated_at`

### `daily_coin_snapshots`

One row per report day per whitelist coin.

Suggested fields:

- `id`
- `report_id`
- `code`
- `price_usdt`
- `change_24h_pct`
- `high_24h`
- `low_24h`
- `quote_volume_24h_usdt`
- `trade_share_pct`
- `close_time`

## AI Design

### Inputs

AI only receives structured Binance-derived metrics.

Input bundle:

- report date
- total traded value across Top 10
- up/down/flat counts
- strongest mover
- weakest mover
- each coin's 24h price change
- each coin's 24h quote volume
- each coin's trade share inside the Top 10 set

### Outputs

Persist two outputs:

- `summary_zh`
- `summary_en`

Requirements:

- no markdown
- no investment advice wording
- concise market recap
- default model: Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash`
- deterministic fallback text if the Workers AI binding is unavailable

## API Direction

Target V1 API shape:

- `GET /health`
- `GET /coins`
- `GET /latest`
- `GET /report/:date`
- `GET /reports?limit=30`
- `GET /coin/:code`
- `GET /run` for manual generation, protected by admin token

Response style:

- JSON only
- no markdown responses
- no RSS/Atom/JSON Feed in V1

## Frontend Direction

### Routing

- `/` redirects to `/zh`
- `/zh`
- `/en`
- `/zh/report/[date]`
- `/en/report/[date]`
- `/zh/coin/[code]`
- `/en/coin/[code]`
- `/zh/archive`
- `/en/archive`

### Rendering rule

The web app should render from structured API responses only.

The old markdown parsing utilities should be considered deprecated.

## Implementation TODO

### Backend

- [ ] replace stock domain model with coin whitelist constants
- [ ] remove markdown report generation and markdown persistence
- [ ] add Binance 24h ticker fetch for whitelist pairs
- [ ] add D1 schema for `coins`, `daily_reports`, `daily_coin_snapshots`
- [ ] seed the fixed 2025 Top 10 whitelist into D1
- [ ] implement daily report generation from Binance snapshot data
- [ ] implement AI summary generation in Chinese and English
- [ ] add JSON endpoints for latest report, history, coins, and coin detail
- [ ] keep scheduled generation and manual `/run`

### Frontend

- [ ] replace stock pages with crypto pages
- [ ] add `/zh` and `/en` routes
- [ ] redirect `/` to `/zh`
- [ ] replace markdown-driven homepage with structured report rendering
- [ ] build archive page from structured report history
- [ ] build coin detail page from structured history
- [ ] update header and navigation for bilingual crypto experience
- [ ] remove dependencies on markdown parsing for primary paths

### Integration

- [ ] update web worker API proxy rules for the new JSON endpoints
- [ ] update metadata, titles, and descriptions
- [ ] update README after implementation
- [ ] run backend and frontend type checks

## Non-Goals For V1

- no news aggregation
- no market cap ranking updates
- no admin CRUD for whitelist editing
- no RSS feeds
- no full historical chart warehouse
- no exchange aggregation across multiple venues
