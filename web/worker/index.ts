import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

type Fetcher = {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
};

interface Env {
  ASSETS: Fetcher;
  CRYPTO_API?: Fetcher;
  CRYPTO_API_BASE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const BLOCKED_COUNTRIES = new Set(["CN"]);
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function resolveCountryCodes(request: Request): string[] {
  const values = [
    typeof request.cf === "object" && request.cf && "country" in request.cf ? request.cf.country : null,
    request.headers.get("x-country-code"),
    request.headers.get("cf-ipcountry")
  ];

  return [...new Set(values.map((value) => value?.trim().toUpperCase()).filter((value): value is string => Boolean(value)))];
}

function isGeoBlocked(request: Request): boolean {
  return resolveCountryCodes(request).some((countryCode) => BLOCKED_COUNTRIES.has(countryCode));
}

function createGeoBlockedResponse(): Response {
  return new Response("Forbidden", {
    status: 403,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function createProxyHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || key.toLowerCase() === "cookie") {
      continue;
    }
    headers.set(key, value);
  }

  const countryCode = resolveCountryCodes(request)[0];
  if (countryCode) {
    headers.set("x-country-code", countryCode);
  }

  return headers;
}

function createProxyRequest(targetUrl: string, request: Request): Request {
  const init: RequestInit = {
    method: request.method,
    headers: createProxyHeaders(request),
    redirect: request.redirect
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return new Request(targetUrl, init);
}

function resolveFallbackApiBaseUrl(env: Env): string {
  return (env.CRYPTO_API_BASE_URL?.trim() || "https://crypto-daily-worker.<your-subdomain>.workers.dev").replace(/\/+$/, "");
}

async function proxyApiRequest(request: Request, env: Env, pathname: string, search: string): Promise<Response> {
  const upstreamPath = pathname.replace(/^\/api/, "") || "/";
  const targetUrl = `${resolveFallbackApiBaseUrl(env)}${upstreamPath}${search}`;

  if (env.CRYPTO_API) {
    try {
      return await env.CRYPTO_API.fetch(createProxyRequest(`https://crypto-api.internal${upstreamPath}${search}`, request));
    } catch {
      return fetch(createProxyRequest(targetUrl, request));
    }
  }

  return fetch(createProxyRequest(targetUrl, request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (isGeoBlocked(request)) {
      return createGeoBlockedResponse();
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return proxyApiRequest(request, env, url.pathname, url.search);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
            return result.response();
          }
        },
        allowedWidths
      );
    }

    return handler.fetch(request);
  }
};
