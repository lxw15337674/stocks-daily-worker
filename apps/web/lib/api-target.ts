type ApiTarget = {
  baseUrl: string;
  pathPrefix: string;
  cookieHeader: string | null;
};

type ServerApiTargetOptions = {
  defaultBaseUrl: string;
  defaultPathPrefix: string;
  headers: Pick<Headers, "get">;
  preferSameOriginInLocal?: boolean;
};

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function getFirstHeaderValue(headers: Pick<Headers, "get">, name: string): string | null {
  const value = headers.get(name)?.trim();
  if (!value) {
    return null;
  }
  const [first] = value.split(",");
  const normalized = first?.trim();
  return normalized || null;
}

function inferRequestOrigin(headers: Pick<Headers, "get">): string | null {
  const host = getFirstHeaderValue(headers, "host");
  if (!host) {
    return null;
  }

  const forwardedProto = getFirstHeaderValue(headers, "x-forwarded-proto");
  const protocol = forwardedProto && /^[A-Za-z][A-Za-z0-9+.-]*$/.test(forwardedProto) ? forwardedProto.toLowerCase() : "http";

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

export function resolveServerApiTarget(options: ServerApiTargetOptions): ApiTarget {
  const inferredBaseUrl = options.preferSameOriginInLocal ? inferRequestOrigin(options.headers) : null;
  return {
    baseUrl: stripTrailingSlashes(inferredBaseUrl ?? options.defaultBaseUrl),
    pathPrefix: options.defaultPathPrefix,
    cookieHeader: options.headers.get("cookie")
  };
}

export type { ApiTarget };
