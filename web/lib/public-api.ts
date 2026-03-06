export type ReportListItem = {
  key: string;
  fileName: string;
  reportDateEt: string;
  createdAt: string;
  source: "d1" | "r2";
};

type ReportListResponse = {
  source: "d1" | "r2";
  limit: number;
  cursor?: string | null;
  nextCursor?: string | null;
  items: ReportListItem[];
};

async function fetchText(path: string): Promise<{ status: number; text: string; headers: Headers }> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store",
    headers: { accept: "text/markdown, text/plain;q=0.8, */*;q=0.5" }
  });

  return {
    status: response.status,
    text: await response.text(),
    headers: response.headers
  };
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store",
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchLatestMarkdown(): Promise<{ markdown: string; fileName?: string } | null> {
  const response = await fetchText("/api/latest");
  if (response.status !== 200) {
    return null;
  }

  return {
    markdown: response.text,
    fileName: response.headers.get("x-report-file") ?? undefined
  };
}

export async function fetchReportByDate(date: string): Promise<string | null> {
  const response = await fetchText(`/api/report/${date}`);
  if (response.status !== 200) {
    return null;
  }
  return response.text;
}

export async function fetchReportList(limit = 60): Promise<ReportListItem[]> {
  const result = await fetchJson<ReportListResponse>(`/api/reports?limit=${Math.max(1, Math.min(limit, 200))}`);
  return result?.items ?? [];
}
