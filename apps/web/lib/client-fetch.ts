export class ClientFetchError extends Error {
  readonly status: number | null;
  readonly code: "fetch-error" | "timeout" | "http-error" | "non-json";

  constructor(
    message: string,
    options: { status?: number | null; code: "fetch-error" | "timeout" | "http-error" | "non-json" }
  ) {
    super(message);
    this.name = "ClientFetchError";
    this.status = options.status ?? null;
    this.code = options.code;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export async function clientFetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: {
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      cache: init.cache ?? "no-store",
      signal: init.signal ?? controller.signal
    });

    if (!response.ok) {
      throw new ClientFetchError(`HTTP ${response.status}`, {
        status: response.status,
        code: "http-error"
      });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new ClientFetchError(`Expected JSON response, received "${contentType || "unknown"}".`, {
        status: response.status,
        code: "non-json"
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ClientFetchError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ClientFetchError(`Request timed out after ${timeoutMs}ms.`, {
        code: "timeout"
      });
    }

    throw new ClientFetchError(toErrorMessage(error), {
      code: "fetch-error"
    });
  } finally {
    clearTimeout(timer);
  }
}

