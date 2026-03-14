import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";

import { resolveServerApiTarget } from "../apps/web/lib/api-target.ts";

function createHeaders(values: Record<string, string | undefined>): Pick<Headers, "get"> {
  const normalized = new Map(Object.entries(values));
  return {
    get(name: string): string | null {
      const value = normalized.get(name);
      return value ?? null;
    }
  };
}

test("resolveServerApiTarget uses the configured stocks API origin without request host inference", () => {
  const target = resolveServerApiTarget({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/stocks",
    headers: createHeaders({ cookie: "session=abc" })
  });

  assert.deepEqual(target, {
    baseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    pathPrefix: "/api/v1/stocks",
    cookieHeader: "session=abc"
  });
});

test("resolveServerApiTarget keeps cookie forwarding but never rewrites to same-origin proxy", () => {
  const target = resolveServerApiTarget({
    defaultBaseUrl: "http://127.0.0.1:8788",
    defaultPathPrefix: "/api/v1/stocks",
    headers: createHeaders({
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: "session=abc"
    })
  });

  assert.deepEqual(target, {
    baseUrl: "http://127.0.0.1:8788",
    pathPrefix: "/api/v1/stocks",
    cookieHeader: "session=abc"
  });
});

test("resolveServerApiTarget supports crypto and root prefixes explicitly", () => {
  const cryptoTarget = resolveServerApiTarget({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1/crypto",
    headers: createHeaders({
      cookie: "admin=yes"
    })
  });

  assert.deepEqual(cryptoTarget, {
    baseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    pathPrefix: "/api/v1/crypto",
    cookieHeader: "admin=yes"
  });

  const rootTarget = resolveServerApiTarget({
    defaultBaseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    defaultPathPrefix: "/api/v1",
    headers: createHeaders({
      cookie: "session=xyz"
    })
  });

  assert.deepEqual(rootTarget, {
    baseUrl: "https://china-stocks-daily-worker.404174262.workers.dev",
    pathPrefix: "/api/v1",
    cookieHeader: "session=xyz"
  });
});

test("local and remote runtime config files stay aligned with matching wrangler vars", () => {
  const root = process.cwd();
  const runtimeLocal = readFileSync(path.join(root, "apps/web/lib/runtime-config.local.ts"), "utf8");
  const runtimeRemote = readFileSync(path.join(root, "apps/web/lib/runtime-config.remote.ts"), "utf8");
  const wranglerLocal = JSON.parse(readFileSync(path.join(root, "apps/web/wrangler.local.jsonc"), "utf8"));
  const wranglerRemote = JSON.parse(readFileSync(path.join(root, "apps/web/wrangler.remote.jsonc"), "utf8"));

  const localBaseUrl = runtimeLocal.match(/SSR_API_BASE_URL = "([^"]+)"/)?.[1];
  const remoteBaseUrl = runtimeRemote.match(/SSR_API_BASE_URL = "([^"]+)"/)?.[1];

  assert.equal(localBaseUrl, wranglerLocal.vars.MARKETS_API_BASE_URL);
  assert.equal(remoteBaseUrl, wranglerRemote.vars.MARKETS_API_BASE_URL);
});
