import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMarketMetricValue,
  formatMarketOhl,
  formatMarketRangePct,
  formatMarketTradingMetrics,
  formatMarketVolume
} from "../apps/web/components/stocks/market-utils.ts";

test("formatMarketVolume renders missing or non-positive values as dash", () => {
  assert.equal(formatMarketVolume(null, "en"), "-");
  assert.equal(formatMarketVolume(0, "en"), "-");
  assert.equal(formatMarketVolume(-10, "en"), "-");
});

test("formatMarketVolume compacts large values", () => {
  const compactThousand = formatMarketVolume(1500, "en");
  const compactMillion = formatMarketVolume(1_250_000, "en");

  assert.notEqual(compactThousand, "-");
  assert.notEqual(compactMillion, "-");
  assert.match(compactThousand, /K/i);
  assert.match(compactMillion, /M/i);
});

test("formatMarketRangePct formats with 2 decimals", () => {
  assert.equal(formatMarketRangePct(null), "-");
  assert.equal(formatMarketRangePct(3.456), "3.46%");
});

test("formatMarketOhl formats each level and handles missing values", () => {
  const result = formatMarketOhl(null, 101, 99, "en");
  assert.equal(result.open, "-");
  assert.equal(result.high, "101.00");
  assert.equal(result.low, "99.00");
});

test("formatMarketMetricValue normalizes nulls and formats numbers", () => {
  assert.equal(formatMarketMetricValue(null, "en"), "-");
  assert.equal(formatMarketMetricValue(22311.98, "en"), "22,311.98");
});

test("formatMarketTradingMetrics maps all trade metrics with fallback dashes", () => {
  const result = formatMarketTradingMetrics(
    {
      dayOpen: 22425.7,
      dayHigh: 22521.38,
      dayLow: 22069.24,
      previousClose: 22311.98,
      fiftyTwoWeekHigh: 24019.99,
      fiftyTwoWeekLow: null
    },
    "en"
  );

  assert.equal(result.open, "22,425.70");
  assert.equal(result.high, "22,521.38");
  assert.equal(result.low, "22,069.24");
  assert.equal(result.previousClose, "22,311.98");
  assert.equal(result.fiftyTwoWeekHigh, "24,019.99");
  assert.equal(result.fiftyTwoWeekLow, "-");
});
