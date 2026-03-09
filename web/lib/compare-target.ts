export type CompareMetric = "change" | "fiveDay";

export type CompareTargetRow = {
  company: string;
  symbol: string | null;
  businessType?: string | null;
  changeValue?: number | null;
  recentFiveDayReturn?: number | null;
};

function normalizeBusinessType(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extractBusinessTags(value: string | null | undefined): string[] {
  const normalized = normalizeBusinessType(value);
  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(/[、,，/／|｜]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function metricValue(row: CompareTargetRow, metric: CompareMetric): number | null {
  return metric === "fiveDay" ? (row.recentFiveDayReturn ?? null) : (row.changeValue ?? null);
}

function businessMatchScore(target: CompareTargetRow, candidate: CompareTargetRow): number {
  const targetNormalized = normalizeBusinessType(target.businessType);
  const candidateNormalized = normalizeBusinessType(candidate.businessType);

  if (!targetNormalized || !candidateNormalized) {
    return 0;
  }

  if (targetNormalized === candidateNormalized) {
    return 3;
  }

  const targetTags = extractBusinessTags(target.businessType);
  const candidateTags = new Set(extractBusinessTags(candidate.businessType));
  const overlapCount = targetTags.filter((tag) => candidateTags.has(tag)).length;
  if (overlapCount > 0) {
    return 1 + overlapCount;
  }

  return 0;
}

function directionPreferenceScore(targetValue: number | null, candidateValue: number | null): number {
  if (targetValue === null || targetValue === 0 || candidateValue === null || candidateValue === 0) {
    return 0;
  }

  return targetValue > 0 ? (candidateValue < 0 ? 1 : 0) : candidateValue > 0 ? 1 : 0;
}

export function pickBestCompareTarget<T extends CompareTargetRow>(
  target: T,
  rows: T[],
  metric: CompareMetric
): T | null {
  const candidates = rows.filter((row) => row.symbol && row.symbol !== target.symbol);
  if (candidates.length === 0) {
    return null;
  }

  const targetMetricValue = metricValue(target, metric);

  return [...candidates].sort((a, b) => {
    const businessScoreDiff = businessMatchScore(target, b) - businessMatchScore(target, a);
    if (businessScoreDiff !== 0) {
      return businessScoreDiff;
    }

    const directionScoreDiff =
      directionPreferenceScore(targetMetricValue, metricValue(b, metric)) -
      directionPreferenceScore(targetMetricValue, metricValue(a, metric));
    if (directionScoreDiff !== 0) {
      return directionScoreDiff;
    }

    return Math.abs(metricValue(b, metric) ?? 0) - Math.abs(metricValue(a, metric) ?? 0);
  })[0] ?? null;
}
