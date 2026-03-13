import type {
  SchedulerJobKey,
  SchedulerJobStatus,
  SchedulerRunMetadata,
  SchedulerRunRecord,
  SchedulerStatusResponse,
  SchedulerTriggerType
} from "@china-stocks/contracts";

export type SchedulerStatusBucket = Pick<R2Bucket, "get" | "list" | "put">;

export const SCHEDULER_JOB_ORDER: readonly SchedulerJobKey[] = [
  "stocks_daily_report",
  "market_indices_summary",
  "crypto_news_ingestion",
  "crypto_daily_report"
];

const HISTORY_PREFIX = "scheduler-runs";
const LATEST_PREFIX = "scheduler-latest";

type RunSuccessInfo = {
  message?: string | null;
  metadata?: SchedulerRunMetadata | null;
};

type RunFailureInfo = {
  message?: string | null;
  metadata?: SchedulerRunMetadata | null;
};

type TrackRunOptions<TResult> = {
  jobKey: SchedulerJobKey;
  triggerType: SchedulerTriggerType;
  triggerLabel?: string | null;
  scheduledFor?: string | null;
  onSuccess?: (result: TResult) => RunSuccessInfo;
  onFailure?: (error: unknown) => RunFailureInfo;
  now?: () => Date;
};

function toIsoTimestamp(value: Date | number | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  return new Date(value).toISOString();
}

function sanitizeTimestampForKey(value: string): string {
  return value.replace(/[:.]/g, "-");
}

function createAttemptId(now: Date): string {
  return `${sanitizeTimestampForKey(now.toISOString())}-${crypto.randomUUID()}`;
}

function latestKey(jobKey: SchedulerJobKey): string {
  return `${LATEST_PREFIX}/${jobKey}.json`;
}

function historyKey(record: SchedulerRunRecord): string {
  const startedAt = new Date(record.startedAt);
  const year = String(startedAt.getUTCFullYear());
  const month = String(startedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(startedAt.getUTCDate()).padStart(2, "0");
  return `${HISTORY_PREFIX}/${record.jobKey}/${year}/${month}/${day}/${sanitizeTimestampForKey(record.startedAt)}--${record.attemptId}.json`;
}

async function putJson(bucket: SchedulerStatusBucket, key: string, value: SchedulerRunRecord): Promise<void> {
  await bucket.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8"
    }
  });
}

async function safePutJson(bucket: SchedulerStatusBucket | undefined, key: string, value: SchedulerRunRecord): Promise<void> {
  if (!bucket) {
    return;
  }

  try {
    await putJson(bucket, key, value);
  } catch (error) {
    console.error(`[scheduler-status] failed to write ${key}: ${toErrorMessage(error)}`);
  }
}

async function readRunRecord(bucket: SchedulerStatusBucket, key: string): Promise<SchedulerRunRecord | null> {
  const object = await bucket.get(key);
  if (!object) {
    return null;
  }

  try {
    return (await object.json()) as SchedulerRunRecord;
  } catch (error) {
    console.error(`[scheduler-status] failed to parse ${key}: ${toErrorMessage(error)}`);
    return null;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function trackSchedulerRun<TResult>(
  bucket: SchedulerStatusBucket | undefined,
  options: TrackRunOptions<TResult>,
  operation: () => Promise<TResult>
): Promise<TResult> {
  const now = options.now ?? (() => new Date());
  const startedAtDate = now();
  const startedAt = startedAtDate.toISOString();
  const baseRecord: SchedulerRunRecord = {
    attemptId: createAttemptId(startedAtDate),
    jobKey: options.jobKey,
    triggerType: options.triggerType,
    triggerLabel: options.triggerLabel ?? null,
    scheduledFor: options.scheduledFor ?? null,
    startedAt,
    finishedAt: null,
    durationMs: null,
    status: "running",
    message: null,
    errorMessage: null,
    metadata: null
  };

  await safePutJson(bucket, latestKey(baseRecord.jobKey), baseRecord);

  try {
    const result = await operation();
    const finishedAt = now();
    const successInfo = options.onSuccess?.(result);
    const finalRecord: SchedulerRunRecord = {
      ...baseRecord,
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - startedAtDate.getTime()),
      status: "success",
      message: successInfo?.message ?? null,
      metadata: successInfo?.metadata ?? null
    };
    await safePutJson(bucket, historyKey(finalRecord), finalRecord);
    await safePutJson(bucket, latestKey(finalRecord.jobKey), finalRecord);
    return result;
  } catch (error) {
    const finishedAt = now();
    const failureInfo = options.onFailure?.(error);
    const finalRecord: SchedulerRunRecord = {
      ...baseRecord,
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - startedAtDate.getTime()),
      status: "failed",
      message: failureInfo?.message ?? null,
      errorMessage: toErrorMessage(error),
      metadata: failureInfo?.metadata ?? null
    };
    await safePutJson(bucket, historyKey(finalRecord), finalRecord);
    await safePutJson(bucket, latestKey(finalRecord.jobKey), finalRecord);
    throw error;
  }
}

export async function readSchedulerStatus(
  bucket: SchedulerStatusBucket | undefined,
  recentLimit = 20
): Promise<SchedulerStatusResponse> {
  const jobs = await readLatestJobStatuses(bucket);
  const recentRuns = await readRecentRuns(bucket, recentLimit);
  return {
    generatedAt: new Date().toISOString(),
    jobs,
    recentRuns
  };
}

export async function readLatestJobStatuses(bucket: SchedulerStatusBucket | undefined): Promise<SchedulerJobStatus[]> {
  if (!bucket) {
    return SCHEDULER_JOB_ORDER.map((jobKey) => ({ jobKey, latest: null }));
  }

  const results = await Promise.all(
    SCHEDULER_JOB_ORDER.map(async (jobKey) => ({
      jobKey,
      latest: await readRunRecord(bucket, latestKey(jobKey))
    }))
  );
  return results;
}

export async function readRecentRuns(
  bucket: SchedulerStatusBucket | undefined,
  recentLimit: number
): Promise<SchedulerRunRecord[]> {
  if (!bucket || recentLimit <= 0) {
    return [];
  }

  const list = await bucket.list({ prefix: `${HISTORY_PREFIX}/` });
  const records = await Promise.all(list.objects.map((object) => readRunRecord(bucket, object.key)));

  return records
    .filter((record): record is SchedulerRunRecord => record !== null)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, recentLimit);
}

export function toScheduledForIso(scheduledTime: number | Date): string {
  return toIsoTimestamp(scheduledTime);
}
