# Draft: AI Feature Exploration

## Requirements (confirmed)
- Explore this project and identify useful AI-powered feature opportunities.
- Stay in discussion/planning mode only; do not generate code before explicit approval.
- Priority direction selected: upgrade existing stock/index daily reports from data listing into structured summaries plus key stock/sector narrative.
- Audience clarified: the enhanced report is for all users, not only internal/pro users.
- Universe clarified: no sector narrative for now; focus on major market indices, China concept stocks, and the top 10 US tech stocks.
- Preferred format clarified: concise morning briefing.
- Narrative inputs clarified: use market data + existing news + AI event-relation synthesis.
- Tracking scope clarified: fixed China concept stock set and fixed top 10 US tech stocks.
- Output preference clarified: model should return pure natural-language morning brief body, not structured fields.
- Rollout preference clarified: replace the current existing AI overview/summary rather than showing old and new versions together.

## Technical Decisions
- Start with codebase/context analysis before proposing solutions.
- Use parallel agents and targeted searches to ground recommendations.

## Research Findings
- Project is a Cloudflare Worker monorepo with backend API in `apps/api/src/index.ts` and frontend worker/proxy in `apps/web/worker/index.ts`.
- Existing scheduled jobs already exist for stocks daily report, market indices summary, crypto hourly news ingestion, and crypto daily report; cron wiring is in `apps/api/wrangler.toml` and dispatch is in `apps/api/src/index.ts`.
- Current persistence stack is D1 for structured market/report/news data and R2 for scheduler run status via `apps/api/src/scheduler-status.ts`.
- AI is already in production for two areas:
  - Crypto: Workers AI binding (`CRYPTO_AI`) used in `apps/api/src/modules/crypto/app.ts`, `apps/api/src/modules/crypto/news.ts`, and `apps/api/src/modules/crypto/intelligence.ts`.
  - Stocks: OpenAI-compatible configuration exposed through env mapping and used in `apps/api/src/modules/stocks/app.ts`.
- Existing user-facing AI surfaces already include AI summaries, AI overview text, AI stock overview, AI preview for stock creation, and crypto intelligence wall; these surfaces appear in built web assets and source UI like `apps/web/components/crypto/report-view.tsx`.
- Strong extension points for new AI features are concentrated in:
  - `apps/api/src/modules/stocks/app.ts`
  - `apps/api/src/modules/crypto/news.ts`
  - `apps/api/src/modules/crypto/intelligence.ts`
  - `apps/api/src/scheduler-status.ts`
  - `packages/contracts/src/index.ts`
- Best-fit AI additions for this architecture are scheduled, data-grounded features rather than chat-only features: anomaly explanation, narrative summaries, watchlist/ranking justification, risk digest, event clustering, and filing/news digestion.

## Candidate Directions
- Data-grounded daily market briefing: summarize structured daily market/sector moves with strict no-causation prompts.
- Abnormal-move explanation: detect unusual volume/price events first with rules, then use AI only to explain the anomaly in plain language.
- Watchlist/ranking rationale: keep existing ranking/scoring deterministic, add AI explanation for why a stock entered the daily focus set.
- Event clustering + impact labels: extend crypto-news style clustering to stocks news and sector events.
- Risk narrative / correlation regime alerts: translate quantitative portfolio or sector risk changes into readable operator summaries.
- Regulatory/news digest: summarize filings or key company announcements with extractive, citation-heavy AI output.

## Technical Decisions
- Recommend prioritizing features that reuse existing scheduler, D1, R2, webhook, and AI invocation paths instead of introducing a separate AI product surface first.
- Recommend keeping core scoring/detection deterministic and letting AI handle synthesis, explanation, and triage.
- Recommend discussing business target first: operator efficiency, end-user engagement, or investment research quality.
- Selected feature family: report enhancement, not chat assistant, not autonomous signal generation.
- Output style should optimize for fast reading and broad-user comprehension, not analyst-depth prose.
- AI is allowed to infer event relationships from market data plus news, but product framing should still avoid prediction or direct investment advice.
- Presentation preference updated: avoid a rigid fixed-format template; prefer prompt-driven generation with more natural narrative structure.
- Recommended compromise to explore: prompt-led prose with soft guardrails on length, coverage, and prohibited language.
- Chosen output contract is a single pure prose body; any stability requirements must be enforced through prompt constraints and preselected inputs rather than schema.

## Open Questions
- Which goal matters most right now: richer daily content, better discovery of unusual stocks/events, or internal ops efficiency?
- Do you want to stay with scheduled batch features first, or also consider an interactive AI assistant/chat layer?
- Are there compliance/risk boundaries we should assume, for example avoiding predictive language or explicit buy/sell suggestions?
- Is your primary audience internal operators, public readers, or paying/pro users?

## Latest Direction
- User chose the report-upgrade path: transform stock/index daily reports into a structured narrative product.
- Audience is broad/public, so output should be readable and concise rather than research-desk heavy.
- Scope narrowed away from sector rotation. Narrative objects should center on:
  - major indices
  - China concept stocks
  - top 10 US tech stocks
- Format selected: concise morning briefing.
- Narrative basis selected: market data + news + AI synthesis of event relationships.
- Universe selected as fixed watchlists rather than dynamic broader pools.
- Initial rollout preference accepted: report detail page top + homepage summary card can be primary surfaces.
- User prefers prompt-driven generation over rigid section templates.
- User rejected light structure and chose pure prose output.
- Length/tone resolved as 200-300 characters/words? user accepted recommended concise range and product-editor style tone; exact implementation unit still to be decided in plan.
- Rollout resolved: new morning brief should replace the current AI summary rather than coexist.
- Remaining clarification needed: test/verification strategy and whether output should cite named stocks/news explicitly every day or allow more macro-only briefs on quiet days.

## Scope Boundaries
- INCLUDE: project analysis, feature ideation, feasibility discussion, prioritization.
- EXCLUDE: implementation and code generation for now.
