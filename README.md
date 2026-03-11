# Crypto Daily Worker

Cloudflare Worker plus Vinext web frontend for a bilingual crypto daily report product.

## Current scope

- fixed Top 10 whitelist derived from Binance Spot `USDT` pairs ranked by 2025 full-year traded value
- daily structured reports stored in D1
- Binance Spot public market data only in V1
- AI summaries in Chinese and English via Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash`
- no markdown report storage

## Main API endpoints

- `GET /health`
- `GET /coins`
- `GET /latest`
- `GET /report/:date`
- `GET /reports?limit=30`
- `GET /coin/:code`
- `GET /run` with `x-admin-token`

## Web routes

- `/zh`
- `/en`
- `/zh/archive`
- `/en/archive`
- `/zh/report/[date]`
- `/en/report/[date]`
- `/zh/coin/[code]`
- `/en/coin/[code]`

## Development

Backend:

```bash
npm install
npm run check
npm run dev
```

Frontend:

```bash
cd web
pnpm install
pnpm check
pnpm dev
```

## Notes

- D1 is required for scheduled daily generation.
- Cloudflare Workers AI binding `AI` is used for bilingual summaries; fallback summaries are generated when the binding is unavailable.
- The current cron is `5 0 * * *` in UTC.
- The redesign plan and TODO list live in `docs/crypto-redesign-plan.md`.
