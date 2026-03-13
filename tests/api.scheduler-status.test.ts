import assert from "node:assert/strict";
import test from "node:test";

import type { SchedulerRunRecord } from "../packages/contracts/src/index.ts";
import {
  cleanupSchedulerHistory,
  readSchedulerStatus,
  trackSchedulerRun,
  type SchedulerStatusBucket
} from "../apps/api/src/scheduler-status.ts";

class FakeR2Bucket implements SchedulerStatusBucket {
  private readonly storage = new Map<string, string>();

  async put(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.storage.delete(key);
    }
  }

  async get(key: string): Promise<{ json(): Promise<SchedulerRunRecord> } | null> {
    const value = this.storage.get(key);
    if (!value) {
      return null;
    }

    return {
      async json(): Promise<SchedulerRunRecord> {
        return JSON.parse(value) as SchedulerRunRecord;
      }
    };
  }

  async list(options?: { cursor?: string; prefix?: string; limit?: number }): Promise<{
    cursor?: string;
    objects: Array<{ key: string }>;
    truncated: boolean;
  }> {
    const prefix = options?.prefix ?? "";
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const objects = [...this.storage.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort()
      .slice(0, limit)
      .map((key) => ({ key }));

    return { objects, truncated: false };
  }
}

class ThrowingListBucket extends FakeR2Bucket {
  override async list(): Promise<{
    cursor?: string;
    objects: Array<{ key: string }>;
    truncated: boolean;
  }> {
    throw new Error("r2 list unavailable");
  }
}

test("trackSchedulerRun records success and updates latest pointer", async () => {
  const bucket = new FakeR2Bucket();

  const result = await trackSchedulerRun(
    bucket,
    {
      jobKey: "stocks_daily_report",
      triggerType: "manual",
      triggerLabel: "stocks:/run",
      now: (() => {
        const values = [new Date("2026-03-13T10:00:00.000Z"), new Date("2026-03-13T10:00:04.200Z")];
        return () => values.shift() ?? new Date("2026-03-13T10:00:04.200Z");
      })(),
      onSuccess: () => ({
        message: "done",
        metadata: { sampleSize: 22 }
      })
    },
    async () => ({ ok: true })
  );

  assert.deepEqual(result, { ok: true });

  const status = await readSchedulerStatus(bucket, 10);
  assert.equal(status.jobs[0].jobKey, "stocks_daily_report");
  assert.equal(status.jobs[0].latest?.status, "success");
  assert.equal(status.jobs[0].latest?.message, "done");
  assert.equal(status.jobs[0].latest?.metadata?.sampleSize, 22);
  assert.equal(status.retentionDays, 14);
  assert.equal(status.recentRuns.length, 1);
  assert.equal(status.recentRuns[0].durationMs, 4200);
  assert.equal(status.jobFailures[0]?.failures.length, 0);
});

test("trackSchedulerRun records failures without swallowing the error", async () => {
  const bucket = new FakeR2Bucket();

  await assert.rejects(
    () =>
      trackSchedulerRun(
        bucket,
        {
          jobKey: "crypto_news_ingestion",
          triggerType: "cron",
          triggerLabel: "10 * * * *",
          scheduledFor: "2026-03-13T10:00:00.000Z",
          now: (() => {
            const values = [new Date("2026-03-13T10:00:00.000Z"), new Date("2026-03-13T10:00:03.500Z")];
            return () => values.shift() ?? new Date("2026-03-13T10:00:03.500Z");
          })(),
          onFailure: () => ({ message: "ingestion failed" })
        },
        async () => {
          throw new Error("boom");
        }
      ),
    /boom/
  );

  const status = await readSchedulerStatus(bucket, 10);
  const latest = status.jobs.find((item) => item.jobKey === "crypto_news_ingestion")?.latest;
  assert.equal(latest?.status, "failed");
  assert.equal(latest?.message, "ingestion failed");
  assert.equal(latest?.errorMessage, "boom");
  assert.equal(status.recentRuns[0]?.status, "failed");
  assert.equal(status.jobFailures.find((item) => item.jobKey === "crypto_news_ingestion")?.failures.length, 1);
  assert.equal(
    status.jobFailures.find((item) => item.jobKey === "crypto_news_ingestion")?.failures[0]?.errorMessage,
    "boom"
  );
});

test("readSchedulerStatus returns the newest history records when many objects exist", async () => {
  const bucket = new FakeR2Bucket();

  for (let index = 0; index < 60; index += 1) {
    const startedAt = new Date(Date.UTC(2026, 2, 1, 0, index, 0));
    await trackSchedulerRun(
      bucket,
      {
        jobKey: index % 2 === 0 ? "stocks_daily_report" : "crypto_news_ingestion",
        triggerType: "cron",
        triggerLabel: "test-cron",
        now: (() => {
          const values = [startedAt, new Date(startedAt.getTime() + 1000)];
          return () => values.shift() ?? new Date(startedAt.getTime() + 1000);
        })()
      },
      async () => ({ index })
    );
  }

  const status = await readSchedulerStatus(bucket, 5);
  assert.equal(status.recentRuns.length, 5);
  assert.deepEqual(
    status.recentRuns.map((run) => run.startedAt),
    [59, 58, 57, 56, 55].map((minute) => new Date(Date.UTC(2026, 2, 1, 0, minute, 0)).toISOString())
  );
});

test("cleanupSchedulerHistory deletes objects older than the retention window", async () => {
  const bucket = new FakeR2Bucket();

  for (const day of ["2026-02-25", "2026-03-01", "2026-03-14"]) {
    await trackSchedulerRun(
      bucket,
      {
        jobKey: "stocks_daily_report",
        triggerType: "cron",
        triggerLabel: "test-cron",
        now: (() => {
          const startedAt = new Date(`${day}T08:00:00.000Z`);
          const values = [startedAt, new Date(startedAt.getTime() + 1000)];
          return () => values.shift() ?? new Date(startedAt.getTime() + 1000);
        })()
      },
      async () => ({ day })
    );
  }

  await cleanupSchedulerHistory(bucket, new Date("2026-03-14T12:00:00.000Z"), 14);

  const status = await readSchedulerStatus(bucket, 10);
  assert.deepEqual(
    status.recentRuns.map((run) => run.startedAt),
    ["2026-03-14T08:00:00.000Z", "2026-03-01T08:00:00.000Z"]
  );
});

test("cleanup failures do not flip a successful run into failed status", async () => {
  const bucket = new ThrowingListBucket();

  const result = await trackSchedulerRun(
    bucket,
    {
      jobKey: "stocks_daily_report",
      triggerType: "manual",
      triggerLabel: "stocks:/run",
      now: (() => {
        const values = [new Date("2026-03-13T10:00:00.000Z"), new Date("2026-03-13T10:00:01.000Z")];
        return () => values.shift() ?? new Date("2026-03-13T10:00:01.000Z");
      })()
    },
    async () => ({ ok: true })
  );

  assert.deepEqual(result, { ok: true });
  const latest = await bucket.get("scheduler-latest/stocks_daily_report.json");
  const record = latest ? ((await latest.json()) as SchedulerRunRecord) : null;
  assert.equal(record?.status, "success");
});
