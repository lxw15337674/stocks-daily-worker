# Crypto News Phase 1

## Goal

Add a phase-one crypto news ingestion pipeline to the unified API worker so the platform can:

- collect recent high-signal crypto market news every hour
- collect recent news for the current 10 tracked coins
- classify and summarize news with Workers AI
- deduplicate repeated coverage through lightweight deterministic checks plus AI clustering
- expose market-news and coin-news APIs without coupling the first release to frontend work

Phase one keeps the existing crypto daily price report intact and adds a separate hourly news ingestion flow.

## Current Implementation Status

The crypto news module is now implemented in the API worker and exposed in the web app.

Current behavior:

- runs on an hourly crypto news cron plus the existing daily crypto report cron
- persists only minimal raw metadata plus curated summaries and relations
- does not persist article body text or full original content
- may fetch article body transiently in-memory for higher-value summary refinement, then discard it
- processes all pending raw candidates each run
- uses AI-first classification, summarization, and clustering, with deterministic fallback when AI returns unusable output

## Scope

The first release covers these tracked coins:

- `BTC`
- `ETH`
- `USDC`
- `SOL`
- `XRP`
- `FDUSD`
- `DOGE`
- `BNB`
- `SUI`
- `TRUMP`

Phase one supports:

- hourly news ingestion
- AI-first relevance filtering
- market-level news exposure
- per-coin news exposure
- admin-triggered manual ingestion
- event clustering for duplicate headlines
- web presentation for market news, coin news, report snapshots, and admin inspection

Phase one does not include:

- historical backfill
- deep human-authored rule systems
- long-term storage of full article bodies

## Operating Model

The crypto module will run two scheduled jobs:

- hourly news ingestion cron
- daily crypto market report cron

The hourly flow:

1. fetch candidate news from a small source set
2. normalize URLs and remove exact duplicates
3. store raw candidates with minimal metadata only
4. ask Workers AI to classify and score candidates using title/source metadata first
5. fetch article body only for selected high-value items, summarize in-memory, then discard the body
6. persist curated news items plus coin/topic relations
7. cluster near-duplicate reports into event groups

The daily report flow remains responsible for price snapshots and daily report summaries.

There is no body-text persistence in D1 or KV. The article body is treated as transient inference input only.

## Source Strategy

Phase one uses a narrow source list so quality stays higher than breadth.

Direct feeds:

- CoinDesk RSS: `https://www.coindesk.com/arc/outboundfeeds/rss`
- Blockworks RSS: `https://blockworks.com/feed`
- Solana News RSS: `https://solana.com/news/rss.xml`

Discovery feeds:

- Google News RSS market query
- Google News RSS per-coin queries

The source mix is intentionally conservative. Google News acts as a discovery layer, while direct feeds provide cleaner crypto-native coverage.

## AI Responsibilities

Workers AI is responsible for:

- relevance classification
- mapping news to one or more tracked coins
- deciding whether news is market-wide
- assigning market topics
- assigning event types
- filtering low-signal and opinion-heavy content
- generating Chinese and English summaries
- clustering duplicate coverage into event groups

If AI fails, times out, or returns unusable output, the pipeline falls back to deterministic heuristics so the ingestion run can still complete.

Deterministic logic is limited to:

- source allowlist
- time-window restriction
- canonical URL normalization
- exact URL/title duplicate removal
- a hard `TRUMP` crypto-context guard

## Database Additions

Phase one adds these crypto news tables:

- `crypto_news_raw`
- `crypto_news_items`
- `crypto_news_item_coins`
- `crypto_news_item_topics`
- `crypto_news_clusters`
- `crypto_news_cluster_members`

### `crypto_news_raw`

Stores fetched candidates before AI curation.

Key fields:

- source metadata
- original and canonical URLs
- title
- published time
- fetch time
- stable dedupe hash
- ingestion status

Extracted snippets and article body text are treated as transient processing inputs and are not persisted.

### `crypto_news_items`

Stores AI-curated news items.

Key fields:

- reference to raw record
- normalized title and URL
- source metadata
- summaries
- relevance type
- event type
- signal/noise scores
- confidence
- display flag
- market-wide flag
- short reason string

### Relation Tables

`crypto_news_item_coins` maps curated items to one or more tracked coins.

`crypto_news_item_topics` maps curated items to market topics such as:

- `regulation`
- `etf`
- `stablecoin`
- `exchange`
- `security`
- `macro`
- `infrastructure`
- `liquidity`

### Clustering Tables

`crypto_news_clusters` stores a representative item plus cluster metadata.

`crypto_news_cluster_members` stores item membership within each cluster.

## API Additions

Phase one adds these endpoints under `/api/v1/crypto`:

- `GET /news/market/latest`
- `GET /news/coin/:code`
- `GET /news/clusters`
- `GET /news/report/:date`
- `GET /news/admin/run`
- `GET /news/admin/overview`
- `GET /news/admin/raw`
- `GET /news/admin/items`
- `GET /news/admin/reprocess`

### `GET /news/market/latest`

Returns curated market-wide news. Supports:

- `limit`
- `hours`
- `topic`

### `GET /news/coin/:code`

Returns curated news linked to a tracked coin. Supports:

- `limit`
- `hours`

### `GET /news/clusters`

Returns recent event clusters for headline deduplication views. Supports:

- `limit`
- `hours`

### `GET /news/report/:date`

Returns the daily crypto report snapshot with:

- market-wide curated news
- cluster summaries
- per-coin curated news grouped by code

### `GET /news/admin/run`

Runs a manual ingestion cycle. Requires `x-admin-token`.

### Admin inspection endpoints

These require `x-admin-token`:

- `/news/admin/overview`
- `/news/admin/raw`
- `/news/admin/items`
- `/news/admin/reprocess`

## AI Output Contracts

### Candidate Classification

Each candidate should be transformed into structured output with:

- `isRelevant`
- `relevanceType`
- `relatedCoins`
- `isMarketWide`
- `marketTopics`
- `eventType`
- `signalScore`
- `noiseScore`
- `confidence`
- `shouldDisplay`
- `reason`
- `summaryZh`
- `summaryEn`

Allowed `relevanceType` values:

- `coin`
- `market`
- `coin_and_market`
- `irrelevant`

Allowed `eventType` values:

- `announcement`
- `listing`
- `delisting`
- `partnership`
- `lawsuit`
- `regulation`
- `hack`
- `exploit`
- `network_upgrade`
- `etf_flow`
- `reserve_update`
- `funding`
- `adoption`

### Cluster Output

Cluster calls should return:

- `clusterId`
- `clusterLabel`
- `representativeNewsId`
- `memberNewsIds`
- `importanceScore`
- `marketImpact`
- `duplicateConfidence`

## Implementation Order

1. add database schema for crypto news tables
2. add hourly cron wiring in the API worker
3. implement candidate feed fetchers
4. implement AI classification and summary generation
5. persist curated items and relations
6. implement AI-driven clustering
7. expose market-news, coin-news, and cluster APIs
8. keep daily price report behavior unchanged
