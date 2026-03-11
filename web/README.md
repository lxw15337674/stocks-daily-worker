# Crypto Daily Web

Vinext web frontend for the bilingual crypto daily report product.

## Features

- `/zh` and `/en` bilingual routing
- structured daily report homepage
- historical report archive
- coin detail pages backed by saved daily snapshots
- JSON API proxy to the backend worker

## Commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm deploy
```

## API Base URL

Set `CRYPTO_API_BASE_URL` in `wrangler.jsonc` if the API worker uses a different domain.

Default placeholder:

```json
"CRYPTO_API_BASE_URL": "https://crypto-daily-worker.<your-subdomain>.workers.dev"
```