import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MarketIndexLatestResponse } from "../packages/contracts/src/index.ts";
import { MarketStatusGrid } from "../apps/web/components/stocks/market-status-grid.tsx";

function createLatest(): MarketIndexLatestResponse {
  return {
    updatedAt: "2026-03-15T02:00:00.000Z",
    regions: [
      {
        region: "cn",
        primaryIndexKey: "cn_sse",
        items: [
          {
            indexKey: "cn_sse",
            symbol: "000001.SS",
            region: "cn",
            nameZh: "上证综指",
            nameEn: "SSE Composite",
            price: 3450.12,
            previousClose: 3422.85,
            changeAbs: 27.27,
            changePct: 0.8,
            dayOpen: 3430.5,
            dayHigh: 3462.11,
            dayLow: 3418.88,
            dayVolume: 792054764,
            dayRangePct: 1.26,
            fiftyTwoWeekHigh: 3674.4,
            fiftyTwoWeekLow: 2635.09,
            currency: "CNY",
            quoteTimestamp: "2026-03-15T02:00:00.000Z",
            isPrimary: true
          }
        ]
      },
      {
        region: "hk",
        primaryIndexKey: "hk_hsi",
        items: []
      },
      {
        region: "us",
        primaryIndexKey: "us_sp500",
        items: []
      }
    ]
  };
}

test("MarketStatusGrid renders expanded trading metrics labels", () => {
  const html = renderToStaticMarkup(
    MarketStatusGrid({
      lang: "zh",
      latest: createLatest(),
      compact: true
    })
  );

  assert.match(html, /交易指标/);
  assert.match(html, /最高/);
  assert.match(html, /今开/);
  assert.match(html, /52周最高/);
  assert.match(html, /昨收/);
  assert.match(html, /52周最低/);
  assert.match(html, /成交量/);
  assert.match(html, /日振幅/);
});
