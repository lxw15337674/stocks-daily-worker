type ApiTarget = {
  baseUrl: string;
  pathPrefix: string;
  cookieHeader: string | null;
};

type ServerApiTargetOptions = {
  defaultBaseUrl: string;
  defaultPathPrefix: string;
  headers: Pick<Headers, "get">;
};

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveServerApiTarget(options: ServerApiTargetOptions): ApiTarget {
  return {
    baseUrl: stripTrailingSlashes(options.defaultBaseUrl),
    pathPrefix: options.defaultPathPrefix,
    cookieHeader: options.headers.get("cookie")
  };
}

export type { ApiTarget };
