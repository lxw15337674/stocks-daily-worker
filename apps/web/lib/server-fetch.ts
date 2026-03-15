const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

class ServerFetchTimeoutError extends Error {
  constructor(readonly label: string, readonly timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms.`);
    this.name = "ServerFetchTimeoutError";
  }
}

type NextFetchInit = RequestInit & {
  next?: { revalidate: number };
};

type SafeFetchJsonOptions = {
  logPrefix: string;
  pathForLog: string;
  timeoutMs?: number;
  fetchImpl?: (input: RequestInfo | URL, init?: NextFetchInit) => Promise<Response>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ServerFetchTimeoutError(label, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init: NextFetchInit,
  options: SafeFetchJsonOptions
): Promise<T | null> {
  const fetcher = options.fetchImpl ?? ((requestInput: RequestInfo | URL, requestInit?: NextFetchInit) => fetch(requestInput, requestInit));
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  try {
    const response = await withTimeout(fetcher(input, init), timeoutMs, `${options.logPrefix} ${options.pathForLog}`);
    if (!response.ok) {
      console.error(`${options.logPrefix} ${options.pathForLog} -> ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      console.error(`${options.logPrefix} ${options.pathForLog} -> non-json response (${contentType || "unknown"})`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    const typeLabel = error instanceof ServerFetchTimeoutError ? "timeout" : "fetch-error";
    console.error(`${options.logPrefix} ${options.pathForLog} -> ${typeLabel} (${toErrorMessage(error)})`);
    return null;
  }
}

export { DEFAULT_FETCH_TIMEOUT_MS, ServerFetchTimeoutError, safeFetchJson, withTimeout, type NextFetchInit };
