import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig, unstable_serialize } from "swr";

import { useReportList, useStockReportByDate } from "../apps/web/lib/api.ts";

test("useReportList reads prefetched SWR fallback data", () => {
  const fallbackRows = [{ reportDateEt: "2026-03-12", createdAt: "2026-03-12T10:00:00.000Z" }];
  const fallback = {
    [unstable_serialize(["stocks-report-list", 2])]: fallbackRows
  };

  let observed: { data: unknown; isLoading: boolean } | null = null;

  function Probe() {
    const state = useReportList(2);
    observed = {
      data: state.data,
      isLoading: state.isLoading
    };
    return null;
  }

  renderToStaticMarkup(
    <SWRConfig value={{ provider: () => new Map(), fallback, revalidateOnMount: false }}>
      <Probe />
    </SWRConfig>
  );

  assert.deepEqual(observed?.data, fallbackRows);
  assert.equal(observed?.isLoading, false);
});

test("useStockReportByDate stays idle when date is null", () => {
  let observed: { data: unknown; isLoading: boolean } | null = null;

  function Probe() {
    const state = useStockReportByDate(null);
    observed = {
      data: state.data,
      isLoading: state.isLoading
    };
    return null;
  }

  renderToStaticMarkup(
    <SWRConfig value={{ provider: () => new Map(), revalidateOnMount: false }}>
      <Probe />
    </SWRConfig>
  );

  assert.equal(observed?.data, undefined);
  assert.equal(observed?.isLoading, false);
});
