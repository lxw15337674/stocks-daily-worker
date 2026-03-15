import assert from "node:assert/strict";
import test from "node:test";

import { safeFetchJson } from "../apps/web/lib/server-fetch.ts";

async function withCapturedConsoleError<T>(runner: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(" "));
  };

  try {
    const result = await runner();
    return { result, logs };
  } finally {
    console.error = original;
  }
}

test("safeFetchJson returns null when fetch throws and does not rethrow", async () => {
  const { result, logs } = await withCapturedConsoleError(async () =>
    safeFetchJson<{ ok: boolean }>(
      "https://example.com/api/v1/stocks/reports",
      { method: "GET" },
      {
        logPrefix: "[web][stocks-api]",
        pathForLog: "/reports",
        fetchImpl: async () => {
          throw new Error("network down");
        }
      }
    )
  );

  assert.equal(result, null);
  assert.ok(logs.some((line) => line.includes("[web][stocks-api] /reports -> fetch-error")));
});

test("safeFetchJson returns null on timeout and emits timeout log prefix", async () => {
  const { result, logs } = await withCapturedConsoleError(async () =>
    safeFetchJson<{ ok: boolean }>(
      "https://example.com/api/v1/stocks/reports",
      { method: "GET" },
      {
        logPrefix: "[web][stocks-api]",
        pathForLog: "/reports",
        timeoutMs: 25,
        fetchImpl: async () => new Promise<Response>(() => undefined)
      }
    )
  );

  assert.equal(result, null);
  assert.ok(logs.some((line) => line.includes("[web][stocks-api] /reports -> timeout")));
});

test("safeFetchJson returns null on non-json responses", async () => {
  const { result, logs } = await withCapturedConsoleError(async () =>
    safeFetchJson<{ ok: boolean }>(
      "https://example.com/api/v1/stocks/reports",
      { method: "GET" },
      {
        logPrefix: "[web][stocks-api]",
        pathForLog: "/reports",
        fetchImpl: async () =>
          new Response("ok", {
            status: 200,
            headers: {
              "content-type": "text/plain; charset=utf-8"
            }
          })
      }
    )
  );

  assert.equal(result, null);
  assert.ok(logs.some((line) => line.includes("[web][stocks-api] /reports -> non-json response")));
});
