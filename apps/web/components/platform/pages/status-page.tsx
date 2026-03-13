import { AlertCircle, CheckCircle2, Clock3, RefreshCcw } from "lucide-react";
import type { SchedulerJobKey, SchedulerRunRecord } from "@china-stocks/contracts";

import { HeroPanel } from "@/components/platform/hero-panel";
import { MetricCard, MetricGrid } from "@/components/platform/metric-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Language } from "@/lib/i18n";
import type { PlatformFreshnessCard, PlatformStatusPageData } from "@/lib/platform-status-core";

type StatusPageProps = {
  lang: Language;
  data: PlatformStatusPageData;
};

const COPY = {
  zh: {
    eyebrow: "系统状态",
    title: "任务运行与数据新鲜度",
    summary: "R2 记录最近的定时任务运行结果，业务区展示股票与数字货币关键数据的最新 freshness。",
    latestJobs: "最新任务状态",
    latestJobsDescription: "每个定时任务最近一次运行结果。",
    recentRuns: "最近运行记录",
    recentRunsDescription: "按开始时间倒序展示最近 24 次 cron/manual 运行。",
    freshness: "数据新鲜度",
    freshnessDescription: "基于现有公开 API 的最近产出时间，帮助判断业务数据是否跟上任务运行。",
    updatedAt: "页面生成",
    noRuns: "暂无运行记录。",
    statusRunning: "运行中",
    statusSuccess: "成功",
    statusFailed: "失败",
    statusSkipped: "跳过",
    triggerCron: "定时",
    triggerManual: "手动",
    latestRun: "最近一次",
    duration: "耗时",
    startedAt: "开始",
    finishedAt: "结束",
    trigger: "触发方式",
    error: "错误",
    fresh: "新鲜",
    stale: "偏旧",
    missing: "缺失",
    jobs: {
      stocks_daily_report: "股票日报",
      market_indices_summary: "全球指数摘要",
      crypto_news_ingestion: "币圈新闻采集",
      crypto_daily_report: "币圈日报"
    },
    freshnessCards: {
      stocks_report: "股票日报归档",
      market_indices_summary: "全球指数摘要",
      crypto_daily_report: "币圈日报归档",
      crypto_macro: "币圈宏观快照",
      crypto_news: "币圈市场新闻"
    }
  },
  en: {
    eyebrow: "System Status",
    title: "Scheduler Runs and Data Freshness",
    summary: "Recent scheduler runs come from R2, while the freshness section reflects the latest visible outputs from the public market APIs.",
    latestJobs: "Latest Job Status",
    latestJobsDescription: "Most recent run result for each scheduled job.",
    recentRuns: "Recent Runs",
    recentRunsDescription: "Latest 24 cron/manual runs sorted by start time.",
    freshness: "Data Freshness",
    freshnessDescription: "Derived from existing public APIs so you can see whether visible market data is keeping up with scheduler activity.",
    updatedAt: "Rendered",
    noRuns: "No scheduler runs recorded yet.",
    statusRunning: "Running",
    statusSuccess: "Success",
    statusFailed: "Failed",
    statusSkipped: "Skipped",
    triggerCron: "Cron",
    triggerManual: "Manual",
    latestRun: "Latest run",
    duration: "Duration",
    startedAt: "Started",
    finishedAt: "Finished",
    trigger: "Trigger",
    error: "Error",
    fresh: "Fresh",
    stale: "Stale",
    missing: "Missing",
    jobs: {
      stocks_daily_report: "Stocks Daily Report",
      market_indices_summary: "Market Indices Summary",
      crypto_news_ingestion: "Crypto News Ingestion",
      crypto_daily_report: "Crypto Daily Report"
    },
    freshnessCards: {
      stocks_report: "Stocks Report Archive",
      market_indices_summary: "Market Indices Summary",
      crypto_daily_report: "Crypto Report Archive",
      crypto_macro: "Crypto Macro Snapshot",
      crypto_news: "Crypto Market News"
    }
  }
} as const;

function formatDateTime(value: string | null, lang: Language): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatDuration(value: number | null, lang: Language): string {
  if (value === null) {
    return "-";
  }

  if (value < 1000) {
    return lang === "zh" ? `${value} 毫秒` : `${value} ms`;
  }

  return lang === "zh" ? `${(value / 1000).toFixed(1)} 秒` : `${(value / 1000).toFixed(1)} s`;
}

function resolveRunStatusLabel(lang: Language, status: SchedulerRunRecord["status"]): string {
  const copy = COPY[lang];
  switch (status) {
    case "running":
      return copy.statusRunning;
    case "success":
      return copy.statusSuccess;
    case "failed":
      return copy.statusFailed;
    default:
      return copy.statusSkipped;
  }
}

function resolveFreshnessLabel(lang: Language, state: PlatformFreshnessCard["state"]): string {
  const copy = COPY[lang];
  switch (state) {
    case "fresh":
      return copy.fresh;
    case "stale":
      return copy.stale;
    default:
      return copy.missing;
  }
}

function resolveFreshnessBadgeClass(state: PlatformFreshnessCard["state"]): string {
  if (state === "fresh") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }
  if (state === "stale") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  return "border-border/70 bg-background/40 text-muted-foreground";
}

function resolveRunBadgeClass(status: SchedulerRunRecord["status"]): string {
  if (status === "success") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "failed") {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }
  if (status === "running") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  }
  return "border-border/70 bg-background/40 text-muted-foreground";
}

function resolveJobLabel(lang: Language, jobKey: SchedulerJobKey): string {
  return COPY[lang].jobs[jobKey];
}

function resolveFreshnessTitle(lang: Language, key: PlatformFreshnessCard["key"]): string {
  return COPY[lang].freshnessCards[key];
}

export default function StatusPage(props: StatusPageProps) {
  const copy = COPY[props.lang];

  return (
    <main className="page-shell">
      <div className="space-y-6">
        <HeroPanel
          eyebrow={copy.eyebrow}
          title={copy.title}
          summary={<p className="max-w-3xl text-sm leading-7 text-muted-foreground">{copy.summary}</p>}
          badges={<Badge variant="outline">{copy.updatedAt}: {formatDateTime(props.data.generatedAt, props.lang)}</Badge>}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{copy.latestJobs}</CardTitle>
            <CardDescription>{copy.latestJobsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {props.data.scheduler.jobs.map((job) => {
                const latest = job.latest;
                return (
                  <MetricCard
                    key={job.jobKey}
                    title={resolveJobLabel(props.lang, job.jobKey)}
                    value={
                      latest ? (
                        <div className="flex items-center gap-2">
                          {latest.status === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : null}
                          {latest.status === "failed" ? <AlertCircle className="h-5 w-5 text-red-200" /> : null}
                          {latest.status === "running" ? <RefreshCcw className="h-5 w-5 text-sky-200" /> : null}
                          {latest.status === "skipped" ? <Clock3 className="h-5 w-5 text-muted-foreground" /> : null}
                          <span>{resolveRunStatusLabel(props.lang, latest.status)}</span>
                        </div>
                      ) : (
                        copy.noRuns
                      )
                    }
                    valueClassName="text-lg font-semibold"
                    description={
                      latest ? (
                        <div className="space-y-2">
                          <Badge variant="outline" className={resolveRunBadgeClass(latest.status)}>
                            {latest.triggerType === "cron" ? copy.triggerCron : copy.triggerManual}
                          </Badge>
                          <div>{copy.latestRun}: {formatDateTime(latest.startedAt, props.lang)}</div>
                          <div>{copy.duration}: {formatDuration(latest.durationMs, props.lang)}</div>
                        </div>
                      ) : null
                    }
                  />
                );
              })}
            </MetricGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{copy.recentRuns}</CardTitle>
            <CardDescription>{copy.recentRunsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {props.data.scheduler.recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.noRuns}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.latestJobs}</TableHead>
                      <TableHead>{copy.trigger}</TableHead>
                      <TableHead>{copy.startedAt}</TableHead>
                      <TableHead>{copy.finishedAt}</TableHead>
                      <TableHead>{copy.duration}</TableHead>
                      <TableHead>{copy.error}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {props.data.scheduler.recentRuns.map((run) => (
                      <TableRow key={run.attemptId}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{resolveJobLabel(props.lang, run.jobKey)}</span>
                            <Badge variant="outline" className={`w-fit ${resolveRunBadgeClass(run.status)}`}>
                              {resolveRunStatusLabel(props.lang, run.status)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{run.triggerType === "cron" ? copy.triggerCron : copy.triggerManual}</TableCell>
                        <TableCell>{formatDateTime(run.startedAt, props.lang)}</TableCell>
                        <TableCell>{formatDateTime(run.finishedAt, props.lang)}</TableCell>
                        <TableCell>{formatDuration(run.durationMs, props.lang)}</TableCell>
                        <TableCell className="max-w-[260px] whitespace-normal text-sm text-muted-foreground">
                          {run.errorMessage ?? run.message ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{copy.freshness}</CardTitle>
            <CardDescription>{copy.freshnessDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {props.data.freshness.map((item) => (
                <MetricCard
                  key={item.key}
                  title={resolveFreshnessTitle(props.lang, item.key)}
                  value={item.primary}
                  description={
                    <div className="space-y-2">
                      <Badge variant="outline" className={resolveFreshnessBadgeClass(item.state)}>
                        {resolveFreshnessLabel(props.lang, item.state)}
                      </Badge>
                      <div>{formatDateTime(item.updatedAt, props.lang)}</div>
                      {item.secondary ? <div>{item.secondary}</div> : null}
                    </div>
                  }
                />
              ))}
            </MetricGrid>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
