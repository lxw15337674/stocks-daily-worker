import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiTargetFromHeaders } from "../apps/web/lib/api-target.ts";

function createHeaders(values: Record<string, string | undefined>): Pick<Headers, "get"> {
  const normalized = new Map(Object.entries(values));
  return {
    get(name: string): string | null {
      const value = normalized.get(name);
      return value ?? null;
    }
  };
}

test("resolveApiTargetFromHeaders falls back to the public stocks API without request host", () => {
  const target = resolveApiTargetFromHeaders({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/stocks",
    proxyPathPrefix: "/api",
    headers: createHeaders({ cookie: "session=abc" }),
    remoteProtocolFallback: "https"
  });

  assert.deepEqual(target, {
    baseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    pathPrefix: "/api/v1/stocks",
    cookieHeader: "session=abc"
  });
});

test("resolveApiTargetFromHeaders routes localhost stocks traffic back through the web worker proxy", () => {
  const target = resolveApiTargetFromHeaders({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/stocks",
    proxyPathPrefix: "/api",
    headers: createHeaders({
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: "session=abc"
    }),
    remoteProtocolFallback: "https"
  });

  assert.deepEqual(target, {
    baseUrl: "http://localhost:3000",
    pathPrefix: "/api",
    cookieHeader: "session=abc"
  });
});

test("resolveApiTargetFromHeaders routes localhost crypto traffic through the crypto proxy prefix", () => {
  const target = resolveApiTargetFromHeaders({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/crypto",
    proxyPathPrefix: "/api/crypto",
    headers: createHeaders({
      host: "127.0.0.1:8788",
      "x-forwarded-proto": "http, https",
      cookie: "admin=yes"
    }),
    remoteProtocolFallback: "https"
  });

  assert.deepEqual(target, {
    baseUrl: "http://127.0.0.1:8788",
    pathPrefix: "/api/crypto",
    cookieHeader: "admin=yes"
  });
});

test("resolveApiTargetFromHeaders keeps remote traffic on the forwarded host and protocol", () => {
  const target = resolveApiTargetFromHeaders({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/stocks",
    proxyPathPrefix: "/api",
    headers: createHeaders({
      "x-forwarded-host": "stocks.example.com",
      "x-forwarded-proto": "https"
    }),
    remoteProtocolFallback: "https"
  });

  assert.deepEqual(target, {
    baseUrl: "https://stocks.example.com",
    pathPrefix: "/api",
    cookieHeader: null
  });
});

test("resolveApiTargetFromHeaders uses the first forwarded host when proxies append a chain", () => {
  const target = resolveApiTargetFromHeaders({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/stocks",
    proxyPathPrefix: "/api",
    headers: createHeaders({
      "x-forwarded-host": "stocks.example.com, edge.example.net",
      "x-forwarded-proto": "https, http"
    }),
    remoteProtocolFallback: "https"
  });

  assert.deepEqual(target, {
    baseUrl: "https://stocks.example.com",
    pathPrefix: "/api",
    cookieHeader: null
  });
});

test("resolveApiTargetFromHeaders does not treat non-local hosts containing localhost as local dev", () => {
  const target = resolveApiTargetFromHeaders({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/stocks",
    proxyPathPrefix: "/api",
    headers: createHeaders({
      host: "api-localhost.example.com",
      "x-forwarded-proto": "https"
    }),
    remoteProtocolFallback: "https"
  });

  assert.deepEqual(target, {
    baseUrl: "https://api-localhost.example.com",
    pathPrefix: "/api",
    cookieHeader: null
  });
});
