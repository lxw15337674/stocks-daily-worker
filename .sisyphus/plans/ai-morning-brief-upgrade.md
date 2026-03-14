# AI Morning Brief Upgrade

## TL;DR

> **Quick Summary**: Replace the current stock/index AI overview with a prompt-driven morning brief that reads like a concise editor-written market note for all users.
>
> **Deliverables**:
> - Replace existing stock report AI overview generation with a new prompt-led morning brief flow
> - Reuse existing market data, fixed watchlists, and news inputs to generate a grounded prose brief
> - Update API/storage/UI consumption so the new brief becomes the default summary surface on stocks home/report experiences
> - Add minimal automated verification plus agent-run QA for happy path, quiet-day fallback, and policy-guardrail scenarios
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: API dataflow audit -> prompt/input contract -> generation + fallback -> UI replacement -> verification

---

## Context

### Original Request
Upgrade the existing stock/index daily report from a data-listing style into a concise, narrative-style morning brief. The new brief should be for all users, cover major indices plus fixed China concept and top-10 US tech watchlists, use market data + news + AI event synthesis, avoid rigid fixed formatting, and replace the current AI overview.

### Interview Summary
**Key Discussions**:
- Audience is broad/public, so the output should read like a product-editor market note rather than an institutional research memo.
- Scope excludes sector narrative; the narrative universe is limited to major indices, a fixed China concept stock set, and a fixed top-10 US tech set.
- Output should be prompt-driven and pure prose, not a structured payload exposed to the frontend.
- Style should be a concise morning briefing in product-editor tone.
- On quiet days, the brief may stay macro-focused and does not need to force named stock mentions.
- Rollout should replace the current AI summary rather than coexist with it.
- Verification should stay lightweight: minimal automated tests plus direct agent QA.

**Research Findings**:
- Backend routing and scheduled execution live in `apps/api/src/index.ts`, which already injects stock AI configuration into the stocks module.
- Existing stock report and AI summary flow are centered in `apps/api/src/modules/stocks/app.ts`.
- Existing storage already contains report-level overview fields in `apps/api/src/modules/stocks/schema.ts` (`report_runs.market_overview`, `report_runs.market_overview_en`) and market-index summary fields in `market_ai_summaries`.
- Frontend stock home/report flow already consumes `StockDailyReport` via `apps/web/lib/api.ts` and renders report overview content through `apps/web/components/stocks/pages/home-page.tsx`.
- Existing watchlists already include the intended China concept names and US tech leaders in `apps/api/src/modules/stocks/app.ts`.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Length unit was ambiguous -> default v1 contract uses `zh` 200-300 Chinese characters and `en` 120-180 words.
- Fallback behavior was unspecified -> v1 uses deterministic fallback prose when AI output is empty, invalid, times out, or violates guardrails.
- Replacement scope was vague -> plan treats replacement as generation + storage + API + UI label/content replacement on stock home/report surfaces.
- Quiet-day behavior was underspecified -> plan explicitly allows macro-only prose on low-signal days.
- Potential hallucinated causality risk -> plan adds strict grounded-input and banned-language validation.

---

## Work Objectives

### Core Objective
Ship a stable v1 morning brief that turns the current stock/index AI overview into a concise, grounded narrative layer while preserving the existing deterministic report pipeline underneath.

### Concrete Deliverables
- A documented input-selection contract for the morning brief using indices, fixed watchlists, report metrics, and linked news.
- A new prompt design and generation path inside the stocks report flow.
- Deterministic fallback prose for AI failure, weak-output, and quiet-market scenarios.
- Updated persistence/API mapping so the new brief replaces the old overview semantics without breaking localized consumption.
- Updated stock home/report UI so the morning brief becomes the primary AI summary surface.
- Minimal automated tests and explicit agent-run QA scenarios.

### Definition of Done
- [ ] Daily stock report generation persists a new morning-brief style overview for the same report object currently consumed by the frontend.
- [ ] Stocks home/report surfaces render the new brief in place of the previous AI overview.
- [ ] Generated text stays within the agreed length rules and avoids banned advice/prediction phrases.
- [ ] Quiet-day reports can render a valid macro-only brief.
- [ ] AI failure or invalid output falls back to deterministic prose instead of leaving the summary empty.

### Must Have
- Prompt-driven prose generation rather than rigid section templates.
- Inputs grounded in existing structured data and existing fetched news.
- Coverage priority across major indices, fixed China concept list, and fixed US top-10 tech list.
- Replace existing AI overview behavior on the stocks report experience.
- Minimal automated verification and agent-run QA.

### Must NOT Have (Guardrails)
- No sector-rotation narrative in v1.
- No personalized summaries, watchlists, chat assistant, or recommendation engine.
- No unsupported facts, price targets, buy/sell language, or deterministic claims of causation.
- No requirement to mention individual stocks on low-signal days.
- No broad homepage information-architecture redesign beyond replacing the current summary surface.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (minimal)
- **Framework**: Node built-in test runner via `pnpm test`

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Each task below includes agent-executable acceptance criteria and QA scenarios. Verification relies on API responses, stored report output, and rendered page HTML/content.

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Start Immediately):
├── Task 1: Audit existing summary dataflow and replacement scope
└── Task 2: Define input contract, prompt contract, and policy guardrails

Wave 2 (After Wave 1):
├── Task 3: Implement generation + fallback in stocks report pipeline
└── Task 4: Update contracts/API/frontend consumption for replacement surface

Wave 3 (After Wave 2):
└── Task 5: Add minimal tests and run end-to-end QA verification

Critical Path: Task 1 -> Task 3 -> Task 4 -> Task 5
Parallel Speedup: ~30% faster than strictly sequential work
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 3 | 1 |
| 3 | 1, 2 | 4, 5 | None |
| 4 | 1, 3 | 5 | None |
| 5 | 3, 4 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | `delegate_task(category="quick"/"unspecified-high", load_skills=["frontend-ui-ux"])` for codebase audit and prompt-contract drafting |
| 2 | 3, 4 | backend-focused executor for generation path, frontend-aware executor for UI/API replacement |
| 3 | 5 | verification-focused executor with shell + curl + page checks |

---

## TODOs

- [ ] 1. Audit the existing AI overview replacement path end-to-end

  **What to do**:
  - Trace how stock report overview text is generated, persisted, exposed, and rendered today.
  - Identify whether `report_runs.market_overview` / `report_runs.market_overview_en` and any related response fields can be reused for the new morning brief.
  - Identify all frontend consumers that currently display or derive text from the stock report overview.
  - Confirm the homepage/report surface that will change first, especially the stocks home flow in `HomePage` and any stock-report detail routes/redirects.

  **Must NOT do**:
  - Do not redesign unrelated stock pages.
  - Do not change crypto report flows.
  - Do not add new feature scope beyond replacing the existing summary path.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: This is a focused audit of existing files and field usage.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Helpful for understanding where summary text is surfaced and how replacement impacts UX copy.
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for audit-only work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 3, 4
  - **Blocked By**: None

  **References**:
  - `apps/api/src/index.ts:62` - Stock env wiring; confirms the stocks module owns AI config and scheduler execution context.
  - `apps/api/src/index.ts:172` - `/api/v1/stocks/*` routing; executor must preserve route-level behavior while replacing summary generation.
  - `apps/api/src/modules/stocks/app.ts:37` - Stocks module env interface; current stock AI and news-body settings live here.
  - `apps/api/src/modules/stocks/app.ts:129` - Default watchlist definitions already include China concept names and US tech leaders; use this to avoid introducing a separate watchlist source.
  - `apps/api/src/modules/stocks/schema.ts:26` - `report_runs` stores report-level overview text; likely replacement target for the morning brief.
  - `apps/api/src/modules/stocks/schema.ts:105` - `market_ai_summaries` stores index-summary text; relevant if index prose is merged into the brief input context.
  - `packages/contracts/src/index.ts:290` - Shared contracts already use localized overview text patterns elsewhere; preserve cross-layer compatibility.
  - `apps/web/lib/api.ts:79` - Stock report fetch entrypoint consumed by frontend.
  - `apps/web/components/stocks/pages/home-page.tsx:130` - Main stocks home page loads the stock report and passes overview text into tab content.
  - `apps/web/components/stocks/pages/home-page.tsx:211` - Existing overview consumption on the main stock surface; key replacement handoff point.
  - `apps/web/components/stocks/pages/report-date-page.tsx:12` - Report-date route currently redirects into home-page-with-date flow; replacement must still cover report-date access.

  **Acceptance Criteria**:
  - [ ] Executor documents the exact current field path used for stock AI overview generation and rendering.
  - [ ] Executor identifies whether current DB columns are reused or whether a rename/migration is required.
  - [ ] Executor lists every stock-home/report UI consumer impacted by the replacement.

  **Agent-Executed QA Scenarios**:

  ```text
  Scenario: Replacement scope is fully mapped before code changes
    Tool: Bash (read/search/test commands as needed)
    Preconditions: Repository available locally
    Steps:
      1. Inspect the stock report schema and report-fetching files.
      2. Search frontend stock pages for overview consumption.
      3. Produce a concrete mapping of generation -> storage -> API -> render.
    Expected Result: Executor can name exact files/fields that must change.
    Failure Indicators: Overview consumer remains unidentified or replacement path is ambiguous.
    Evidence: Notes linked to referenced file paths in implementation output.
  ```

- [ ] 2. Define the morning-brief input contract, prompt contract, and policy guardrails

  **What to do**:
  - Define the deterministic payload sent into the model: major indices, fixed China concept list signals, fixed US top-10 tech signals, selected news/event snippets, and quiet-day indicators.
  - Define the generation contract as pure prose with no explicit fixed template.
  - Encode v1 style rules: product-editor tone, concise morning-read pacing, grounded event linkage, macro-only allowed on quiet days.
  - Encode policy rules: no recommendation language, no unsupported causation, no stocks outside allowed watchlists unless present in explicitly permitted indices context.
  - Define output validation rules and deterministic fallback prose generation.

  **Must NOT do**:
  - Do not let the prompt become a rigid section template.
  - Do not allow the model to introduce entities absent from the prepared input.
  - Do not optimize for analyst-depth at the cost of readability.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Prompt and content-policy design needs careful judgment and guardrails.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Useful for keeping tone aligned with a consumer product rather than internal research prose.
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not relevant to content-design work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: 3
  - **Blocked By**: None

  **References**:
  - `README.md:117` - Existing AI summary behavior currently targets Chinese-char-limited overviews; use this as the baseline to evolve rather than reinvent the product tone.
  - `apps/api/src/modules/stocks/app.ts:83` - `ReportSummary` already separates stock summaries from market overview text; morning brief input should be assembled at this abstraction boundary.
  - `apps/api/src/modules/stocks/app.ts:129` - Watchlist source of truth for named stocks and aliases.
  - `apps/api/src/modules/stocks/schema.ts:31` - Existing overview columns imply the summary is persisted per report date; prompt contract should fit a persisted-on-generation model.
  - `apps/web/components/stocks/pages/home-page.tsx:194` - Existing stocks home page already shows market pulse + report content; prompt tone should complement, not duplicate, nearby market widgets.

  **Acceptance Criteria**:
  - [ ] Prompt contract specifies allowed inputs, forbidden language, and quiet-day behavior.
  - [ ] Output validation rules define exact length targets, language rules, and fallback trigger conditions.
  - [ ] Contract clearly distinguishes deterministic selection from model-authored prose.

  **Agent-Executed QA Scenarios**:

  ```text
  Scenario: Prompt contract supports both high-signal and quiet-day reports
    Tool: Bash (unit tests or fixture-driven script)
    Preconditions: Prompt builder/input-preparation code exists
    Steps:
      1. Feed a high-signal fixture with multiple notable names and linked news.
      2. Feed a quiet-day fixture with low volatility and sparse news.
      3. Assert the prepared prompt payload differs appropriately while preserving policy instructions.
    Expected Result: High-signal input permits named-stock narrative; quiet-day input permits macro-only prose.
    Failure Indicators: Quiet-day input still forces stock mentions or high-signal input lacks entity/news grounding.
    Evidence: Captured fixture output or snapshot assertions.
  ```

- [ ] 3. Implement morning-brief generation, validation, and fallback in the stocks report pipeline

  **What to do**:
  - Replace or refactor the current overview-generation step so it builds the new morning brief instead of the legacy AI summary style.
  - Preserve localized behavior by generating/storing `zh` and `en` pure prose variants through the existing localized overview path unless direct evidence in Task 1 shows a narrower contract is safer.
  - Add post-generation validation for length, banned phrases, allowed entities, and non-empty output.
  - Implement deterministic fallback prose when AI output is missing, invalid, timed out, or policy-violating.
  - Ensure scheduled stock report generation and any manual/admin reruns use the same logic.

  **Must NOT do**:
  - Do not remove deterministic report generation if AI fails.
  - Do not make report generation depend on frontend-only transformations.
  - Do not introduce extra AI surfaces or alternate report variants in v1.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: This touches persisted report generation and AI guardrails in a production pipeline.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Keeps output aligned with the target consumer tone while implementing text-related logic.
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed at implementation stage.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 4, 5
  - **Blocked By**: 1, 2

  **References**:
  - `apps/api/src/index.ts:62` - New generation path must keep using stock AI env configuration from the unified worker.
  - `apps/api/src/index.ts:192` - Scheduled cron path must continue to produce the report summary during stock report runs.
  - `apps/api/src/modules/stocks/app.ts:37` - AI env variables and news-body fetch settings relevant to prompt input size and model calls.
  - `apps/api/src/modules/stocks/app.ts:74` - `NewsItem` structure shows available title/source/publishedAt/bodySnippet context for grounded prompt input.
  - `apps/api/src/modules/stocks/app.ts:83` - `ReportSummary` type boundary is the likely place to reshape summary generation output.
  - `apps/api/src/modules/stocks/schema.ts:26` - Report-level persistence target for the new brief.
  - `README.md:158` - Existing AI summary configuration details help preserve provider compatibility and operational assumptions.

  **Acceptance Criteria**:
  - [ ] Stock report generation persists localized morning brief prose into the report-level overview storage path.
  - [ ] Invalid AI output triggers deterministic fallback prose instead of null/empty summary.
  - [ ] Generated text obeys length and banned-language validation.
  - [ ] Quiet-day input can produce valid macro-only prose without forced stock mentions.

  **Agent-Executed QA Scenarios**:

  ```text
  Scenario: Scheduled report run stores a valid morning brief
    Tool: Bash (API dev server + curl)
    Preconditions: Local API running, local D1 initialized, stock report generation endpoint or cron trigger available
    Steps:
      1. Trigger stock report generation for a test date using the existing manual/admin flow or scheduled equivalent.
      2. Request the generated stock report JSON for that date.
      3. Assert the overview field now contains morning-brief style prose.
      4. Assert the prose length is within the agreed bounds.
      5. Assert no banned advice/prediction phrases are present.
    Expected Result: Report JSON contains a non-empty validated morning brief.
    Failure Indicators: Empty summary, legacy-style output, banned phrases, or missing localized content.
    Evidence: Saved response body under `.sisyphus/evidence/task-3-report-response.json`.

  Scenario: AI failure falls back to deterministic prose
    Tool: Bash (test run with mocked/disabled AI path)
    Preconditions: Local environment configured to simulate AI timeout/error
    Steps:
      1. Trigger report generation with AI provider unavailable or mocked to fail.
      2. Fetch the generated report JSON.
      3. Assert overview text is still present.
      4. Assert fallback prose contains deterministic market wording only and no AI-error leakage.
    Expected Result: Report remains readable and non-empty despite AI failure.
    Failure Indicators: Null overview, raw error text, or report generation aborts.
    Evidence: Saved response body under `.sisyphus/evidence/task-3-fallback-response.json`.
  ```

- [ ] 4. Update shared contracts, API consumers, and stock UI rendering to make the morning brief the primary summary surface

  **What to do**:
  - Update shared contracts only if needed to clarify naming/semantics while avoiding unnecessary API churn.
  - Ensure the frontend resolves and displays the new morning brief through the existing stock report fetch path.
  - Replace legacy stock AI summary labels/copy where the new prose is shown.
  - Ensure homepage stock summary card / report-linked content uses the new brief and gracefully handles quiet-day or fallback text.
  - Preserve route behavior for direct report-date access and stocks home with `?date=`.

  **Must NOT do**:
  - Do not redesign tabs, tables, or unrelated widgets.
  - Do not introduce a second alternative summary component.
  - Do not break localized rendering.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: This is a user-facing content replacement on existing UI surfaces.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Useful to ensure copy hierarchy and spacing still support a prose-first summary.
  - **Skills Evaluated but Omitted**:
    - `shadcn`: Existing primitives are enough; no new component library work required.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 5
  - **Blocked By**: 1, 3

  **References**:
  - `apps/web/lib/api.ts:79` - Existing stock report fetch path that should continue to supply the report summary.
  - `apps/web/lib/stocks-report.ts:5` - `resolveLocalizedText` already handles bilingual text selection for frontend rendering.
  - `apps/web/components/stocks/pages/home-page.tsx:130` - Main page fetches the selected report.
  - `apps/web/components/stocks/pages/home-page.tsx:194` - Top-of-page area where market pulse and report content are assembled.
  - `apps/web/components/stocks/pages/home-page.tsx:211` - Current overview payload handoff into tab content; replace semantics here without changing report navigation.
  - `apps/web/app/[lang]/stocks/report/[date]/page.tsx:1` - Report-date route funnels users into the same stocks home/report experience.
  - `apps/web/components/stocks/pages/report-date-page.tsx:12` - Redirect behavior must still land on a page that shows the new brief.
  - `packages/contracts/src/index.ts:290` - Localized overview-type patterns to preserve if contract names remain stable.

  **Acceptance Criteria**:
  - [ ] Stocks home/report UI renders the new morning brief in the location previously used for the AI overview.
  - [ ] Legacy summary labels/copy on the target surface no longer describe the content as the old AI overview.
  - [ ] Quiet-day and fallback prose render without layout breakage or awkward truncation.

  **Agent-Executed QA Scenarios**:

  ```text
  Scenario: Stocks home page shows the new morning brief for a selected report date
    Tool: Playwright (playwright skill)
    Preconditions: Local web server and API server running, report exists for target date
    Steps:
      1. Navigate to the stocks home page with `?date=<report-date>`.
      2. Wait for the report content to load.
      3. Locate the summary/overview prose block near the top report content area.
      4. Assert the block contains a multi-sentence natural-language brief rather than the legacy short summary style.
      5. Assert the prose does not contain banned recommendation language.
      6. Capture a screenshot.
    Expected Result: The new morning brief is the primary summary surface.
    Failure Indicators: Old AI overview still appears, summary missing, or prose overflows/truncates badly.
    Evidence: `.sisyphus/evidence/task-4-home-brief.png`
  ```

- [ ] 5. Add minimal automated tests and run end-to-end verification

  **What to do**:
  - Add focused tests around prompt input selection, validation/fallback behavior, and frontend rendering/loader expectations where practical.
  - Prefer small targeted tests in `tests/` using the existing Node test runner.
  - Run relevant test commands and direct API/page checks.
  - Verify that replacement does not regress existing report loading behavior.

  **Must NOT do**:
  - Do not build a heavyweight prompt snapshot suite.
  - Do not introduce new test frameworks.
  - Do not skip failure-path verification.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused verification and small tests on top of implemented logic.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Helpful for validating that rendered prose still fits the intended content hierarchy.
  - **Skills Evaluated but Omitted**:
    - `shadcn`: Unnecessary for verification.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: 3, 4

  **References**:
  - `tests/web.status-loaders.test.ts:51` - Existing tests already assert human-readable scheduler error strings; follow this style for concise behavior assertions.
  - `apps/web/AGENTS.md:20` - Web test guidance: use Node test runner and keep tests small and explicit.
  - `README.md:44` - Local API warm-up endpoints useful for making sure local D1 is initialized before verification.
  - `apps/web/lib/api.ts:79` - Report-fetch contract to validate in tests.
  - `apps/web/components/stocks/pages/home-page.tsx:130` - Main report-loading path that should remain stable.

  **Acceptance Criteria**:
  - [ ] Automated tests cover at least: valid morning brief path, invalid-output fallback path, and frontend/report-loader consumption of the replaced summary field.
  - [ ] `pnpm test` passes.
  - [ ] Manual-equivalent agent QA confirms the new brief appears on the stock page and remains policy-safe.

  **Agent-Executed QA Scenarios**:

  ```text
  Scenario: Automated verification passes for morning-brief replacement
    Tool: Bash
    Preconditions: Changes implemented locally
    Steps:
      1. Run `pnpm test` from the repository root.
      2. Assert exit code 0.
      3. Inspect output for the new morning-brief-related tests.
    Expected Result: Existing and new tests pass.
    Failure Indicators: Non-zero exit, failing fallback/policy tests, or broken report loaders.
    Evidence: Terminal output captured.

  Scenario: API response exposes usable replaced summary content
    Tool: Bash (curl)
    Preconditions: Local API server running and report available
    Steps:
      1. Request `GET /api/v1/stocks/report-data/<date>`.
      2. Assert the response includes localized overview text for the selected date.
      3. Assert the summary text length matches agreed rules.
      4. Assert banned phrases do not appear.
    Expected Result: API delivers the new brief consistently.
    Failure Indicators: Missing field, empty field, banned phrases, or legacy text not replaced.
    Evidence: `.sisyphus/evidence/task-5-api-response.json`
  ```

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 3 | `feat(stocks): upgrade ai overview to morning brief` | `apps/api/src/modules/stocks/*`, `packages/contracts/*` | targeted tests + API check |
| 4 | `feat(web): replace stock ai summary surface` | `apps/web/components/stocks/*`, `apps/web/lib/*` | page rendering check |
| 5 | `test(stocks): cover morning brief fallback and rendering` | `tests/*` | `pnpm test` |

---

## Defaults Applied

- **Length rule**: Default to `zh` 200-300 Chinese characters and `en` 120-180 words for v1. Adjust only if code inspection shows an existing stricter storage/display limit.
- **Localization**: Preserve bilingual/localized overview behavior by default because the current app and contracts are locale-aware.
- **Generation timing**: Default to generating and persisting the morning brief during report generation, not on-demand page render.
- **Surface scope**: Replace current stock summary behavior on the stocks home/report experience first; homepage summary-card expansion should only happen if an existing stock-home summary card already consumes the same report object.
- **Quiet-day policy**: Macro-only prose is valid; named stocks are optional when signals are weak.

## Auto-Resolved

- **Fallback behavior**: Resolved as deterministic prose fallback instead of empty-state suppression.
- **Replacement semantics**: Resolved as end-to-end replacement of the current summary path on stock report surfaces, not visual coexistence.
- **Testing scope**: Resolved as focused tests-after with existing Node test runner instead of new infra.

## Decisions Needed

- None blocking for v1 plan generation. If implementation discovers that overview storage is single-language-only or materially constrained, re-open the localization/length defaults before coding.

---

## Success Criteria

### Verification Commands
```bash
pnpm test
# Expected: all tests pass including new morning-brief validation/fallback coverage

curl -s http://127.0.0.1:8787/api/v1/stocks/report-data/<DATE>
# Expected: report JSON contains localized overview text with the new morning-brief semantics
```

### Final Checklist
- [ ] Existing stock AI overview behavior is replaced by a prompt-driven morning brief.
- [ ] Brief remains grounded in market data + existing news and never requires human rewrite.
- [ ] Quiet-day reports remain readable without forced stock mentions.
- [ ] Frontend stock home/report experience renders the new brief cleanly.
- [ ] AI failure paths fall back safely.
- [ ] Minimal automated tests and direct QA both pass.
