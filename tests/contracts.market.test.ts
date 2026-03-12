import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKET_INDEX_KEYS,
  MARKET_INDEX_RANGES,
  type MarketAiSummaryRecord
} from "../packages/contracts/src/index.ts";

test("market contracts expose stable runtime keys and ranges", () => {
  assert.deepEqual(MARKET_INDEX_RANGES, ["1m", "3m", "1y"]);
  assert.equal(new Set(MARKET_INDEX_KEYS).size, MARKET_INDEX_KEYS.length);
  assert.ok(MARKET_INDEX_KEYS.includes("cn_sse"));
  assert.ok(MARKET_INDEX_KEYS.includes("us_sp500"));
});

test("market AI archive record shape can represent localized summaries and snapshots", () => {
  const sample: MarketAiSummaryRecord = {
    summaryDate: "2026-03-12",
    scope: "global_indices",
    summary: {
      zh: "A股偏强，美股回落。",
      en: "China led while the US eased."
    },
    snapshotCount: 3,
    createdAt: "2026-03-12T01:23:45.000Z",
    items: [
      {
        indexKey: "cn_sse",
        symbol: "000001.SS",
        region: "cn",
        nameZh: "上证综指",
        nameEn: "SSE Composite",
        close: 3200,
        previousClose: 3180,
        changeAbs: 20,
        changePct: 0.63,
        currency: "CNY",
        quoteTimestamp: "2026-03-12T01:23:45.000Z",
        isPrimary: true
      }
    ],
    model: "gpt-4o-mini"
  };

  assert.equal(sample.summary.zh, "A股偏强，美股回落。");
  assert.equal(sample.items[0].indexKey, "cn_sse");
  assert.equal(sample.items[0].isPrimary, true);
});
