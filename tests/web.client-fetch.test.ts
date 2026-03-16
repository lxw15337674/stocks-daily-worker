import assert from "node:assert/strict";
import test from "node:test";

import { ClientFetchError, clientFetchJson } from "../apps/web/lib/client-fetch.ts";

const originalFetch = globalThis.fetch;

function mockFetch(impl: typeof fetch) {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: impl
  });
}

function restoreFetch() {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: originalFetch
  });
}

test("clientFetchJson throws http-error on non-2xx", async () => {
  mockFetch(async () => new Response("Unauthorized", { status: 401 }));

  await assert.rejects(
    () => clientFetchJson("https://example.com/api"),
    (error) => error instanceof ClientFetchError && error.code === "http-error" && error.status === 401
  );

  restoreFetch();
});

test("clientFetchJson throws non-json when content-type is not json", async () => {
  mockFetch(async () =>
    new Response("ok", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    })
  );

  await assert.rejects(
    () => clientFetchJson("https://example.com/api"),
    (error) => error instanceof ClientFetchError && error.code === "non-json"
  );

  restoreFetch();
});

test("clientFetchJson throws timeout when request exceeds timeout", async () => {
  mockFetch(async (_input, init) => {
    await new Promise((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
    throw new Error("unreachable");
  });

  await assert.rejects(
    () => clientFetchJson("https://example.com/api", {}, { timeoutMs: 25 }),
    (error) => error instanceof ClientFetchError && error.code === "timeout"
  );

  restoreFetch();
});
