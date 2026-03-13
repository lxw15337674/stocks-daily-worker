type ApiTarget = {
  baseUrl: string;
  pathPrefix: string;
  cookieHeader: string | null;
};

type ApiTargetOptions = {
  defaultBaseUrl: string;
  defaultPathPrefix: string;
  proxyPathPrefix: string;
  headers: Pick<Headers, "get">;
  remoteProtocolFallback?: "http" | "https";
};

function isLocalDevHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  const hostname = normalized.split(":")[0] ?? normalized;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveForwardedProtocol(headers: Pick<Headers, "get">): string | null {
  const forwardedProto = headers.get("x-forwarded-proto");
  const normalized = forwardedProto?.split(",")[0]?.trim();
  return normalized || null;
}

function resolveForwardedHost(headers: Pick<Headers, "get">): string | null {
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  const normalized = forwardedHost?.split(",")[0]?.trim();
  return normalized || null;
}

export function resolveApiTargetFromHeaders(options: ApiTargetOptions): ApiTarget {
  const host = resolveForwardedHost(options.headers);
  const cookieHeader = options.headers.get("cookie");

  if (!host) {
    return {
      baseUrl: options.defaultBaseUrl,
      pathPrefix: options.defaultPathPrefix,
      cookieHeader
    };
  }

  const forwardedProtocol = resolveForwardedProtocol(options.headers);
  if (isLocalDevHost(host)) {
    return {
      baseUrl: stripTrailingSlashes(`${forwardedProtocol || "http"}://${host}`),
      pathPrefix: options.proxyPathPrefix,
      cookieHeader
    };
  }

  return {
    baseUrl: stripTrailingSlashes(`${forwardedProtocol || options.remoteProtocolFallback || "https"}://${host}`),
    pathPrefix: options.proxyPathPrefix,
    cookieHeader
  };
}

export type { ApiTarget };
