# Draft: Online To Local DB Sync

## Requirements (confirmed)
- Task intent: plan how to sync online/production data into a local database.
- Local target: local D1/SQLite.
- Sync mode: one-time full snapshot from online to local.
- Source mode: direct database-to-database copy, not API replay.

## Technical Decisions
- Planning mode only; no implementation commands will be executed in this session.
- Preferred sync strategy: rebuild local schema from existing migrations, then import production data.

## Research Findings
- `apps/web/README.md`: web app primarily talks to a remote API worker via `MARKETS_API_BASE_URL`.
- `apps/web/wrangler.jsonc`: web worker binds to `MARKETS_API` service and sets `MARKETS_API_BASE_URL`; no local DB is declared here.
- `apps/web/package.json`: no seed/import/migrate scripts are defined in the web app package.

## Open Questions
- Which exact production database/binding is the source of truth?
- Is the real data store defined under `apps/api` or another workspace package outside `apps/web`?
- Are there privacy/secrets constraints that prevent copying some production rows locally?

## Scope Boundaries
- INCLUDE: identify current data/storage architecture and create a work plan.
- EXCLUDE: actual data copy or implementation in this planning session.

## Data Boundary
- User preference: full production data copy to local; no masking/exclusion requested.
