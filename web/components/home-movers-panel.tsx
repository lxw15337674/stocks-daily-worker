"use client";

import Link from "next/link";
import { useMemo } from "react";

import { pickBestCompareTarget } from "@/lib/compare-target";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type RankMetric = "change" | "fiveDay";

type RankSection = {
  title: string;
  rows: ParsedReportStockRow[];
  metric: RankMetric;
  description: string;
  meta?: (row: ParsedReportStockRow) => string | null;
};

function metricTextClass(value: number | null): string {
  if (value === null) {
    return "text-muted-foreground";
  }
  if (value > 0) {
    return "text-red-400";
  }
  if (value < 0) {
    return "text-emerald-400";
  }
  return "text-muted-foreground";
}

function formatChange(value: string): string {
  return value.trim() || "-";
}

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildCompareDetailUrl(symbol: string | null, compareSymbol: string | null): string | null {
  if (!symbol) {
    return null;
  }

  const base = `/stock/${encodeURIComponent(symbol)}`;
  return compareSymbol ? `${base}?compare=${encodeURIComponent(compareSymbol)}` : base;
}

function pickComparisonCandidate(
  row: ParsedReportStockRow,
  rows: ParsedReportStockRow[],
  metric: RankMetric
): ParsedReportStockRow | null {
  return pickBestCompareTarget(row, rows, metric);
}

function buildRowHref(row: ParsedReportStockRow, rows: ParsedReportStockRow[], metric: RankMetric): string | null {
  if (!row.detailUrl) {
    return row.xueqiuUrl;
  }

  const compareTarget = pickComparisonCandidate(row, rows, metric);
  return buildCompareDetailUrl(row.symbol, compareTarget?.symbol ?? null) ?? row.detailUrl;
}

function rankRows(rows: ParsedReportStockRow[]): {
  gainers: ParsedReportStockRow[];
  decliners: ParsedReportStockRow[];
  swings: ParsedReportStockRow[];
  mostMentioned: ParsedReportStockRow[];
  streakUp: ParsedReportStockRow[];
  streakDown: ParsedReportStockRow[];
  strongestFiveDay: ParsedReportStockRow[];
  weakestFiveDay: ParsedReportStockRow[];
  mostMentionedFiveDay: ParsedReportStockRow[];
  sustainedStrengthFiveDay: ParsedReportStockRow[];
  sustainedWeaknessFiveDay: ParsedReportStockRow[];
} {
  const withChange = rows.filter((row) => row.changeValue !== null);
  const gainers = [...withChange].sort((a, b) => (b.changeValue ?? -Infinity) - (a.changeValue ?? -Infinity)).slice(0, 5);
  const decliners = [...withChange].sort((a, b) => (a.changeValue ?? Infinity) - (b.changeValue ?? Infinity)).slice(0, 5);
  const swings = [...withChange]
    .sort((a, b) => Math.abs(b.changeValue ?? 0) - Math.abs(a.changeValue ?? 0))
    .slice(0, 5);
  const mostMentioned = [...rows]
    .sort((a, b) => (b.newsCount ?? 0) - (a.newsCount ?? 0) || Math.abs(b.changeValue ?? 0) - Math.abs(a.changeValue ?? 0))
    .filter((row) => (row.newsCount ?? 0) > 0)
    .slice(0, 5);
  const streakUp = [...rows]
    .filter((row) => row.streak?.direction === "up" && (row.streak?.count ?? 0) >= 2)
    .sort((a, b) => (b.streak?.count ?? 0) - (a.streak?.count ?? 0) || (b.changeValue ?? -Infinity) - (a.changeValue ?? -Infinity))
    .slice(0, 5);
  const streakDown = [...rows]
    .filter((row) => row.streak?.direction === "down" && (row.streak?.count ?? 0) >= 2)
    .sort((a, b) => (b.streak?.count ?? 0) - (a.streak?.count ?? 0) || (a.changeValue ?? Infinity) - (b.changeValue ?? Infinity))
    .slice(0, 5);
  const strongestFiveDay = [...rows]
    .filter((row) => row.recentFiveDayReturn !== null && row.recentFiveDayReturn !== undefined)
    .sort((a, b) => (b.recentFiveDayReturn ?? -Infinity) - (a.recentFiveDayReturn ?? -Infinity))
    .slice(0, 5);
  const weakestFiveDay = [...rows]
    .filter((row) => row.recentFiveDayReturn !== null && row.recentFiveDayReturn !== undefined)
    .sort((a, b) => (a.recentFiveDayReturn ?? Infinity) - (b.recentFiveDayReturn ?? Infinity))
    .slice(0, 5);
  const mostMentionedFiveDay = [...rows]
    .filter((row) => (row.recentFiveDayNewsCount ?? 0) > 0)
    .sort((a, b) => (b.recentFiveDayNewsCount ?? 0) - (a.recentFiveDayNewsCount ?? 0) || (b.newsCount ?? 0) - (a.newsCount ?? 0))
    .slice(0, 5);
  const sustainedStrengthFiveDay = [...rows]
    .filter((row) => (row.recentPositiveDays ?? 0) >= 3 && (row.recentFiveDayReturn ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.recentPositiveDays ?? 0) - (a.recentPositiveDays ?? 0) ||
        (b.recentFiveDayReturn ?? -Infinity) - (a.recentFiveDayReturn ?? -Infinity)
    )
    .slice(0, 5);
  const sustainedWeaknessFiveDay = [...rows]
    .filter((row) => (row.recentNegativeDays ?? 0) >= 3 && (row.recentFiveDayReturn ?? 0) < 0)
    .sort(
      (a, b) =>
        (b.recentNegativeDays ?? 0) - (a.recentNegativeDays ?? 0) ||
        (a.recentFiveDayReturn ?? Infinity) - (b.recentFiveDayReturn ?? Infinity)
    )
    .slice(0, 5);

  return {
    gainers,
    decliners,
    swings,
    mostMentioned,
    streakUp,
    streakDown,
    strongestFiveDay,
    weakestFiveDay,
    mostMentionedFiveDay,
    sustainedStrengthFiveDay,
    sustainedWeaknessFiveDay
  };
}

function renderCompanyLink(row: ParsedReportStockRow, href: string | null) {
  if (href) {
    const isExternal = /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="font-medium text-foreground transition hover:text-primary">
          {row.company}
        </a>
      );
    }

    return (
      <Link href={href} className="font-medium text-foreground transition hover:text-primary">
        {row.company}
      </Link>
    );
  }

  if (row.xueqiuUrl) {
    return (
      <a href={row.xueqiuUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground transition hover:text-primary">
        {row.company}
      </a>
    );
  }

  return <span className="font-medium text-foreground">{row.company}</span>;
}

function getPrimaryMetricValue(row: ParsedReportStockRow, metric: RankMetric): number | null {
  return metric === "fiveDay" ? (row.recentFiveDayReturn ?? null) : row.changeValue;
}

function getPrimaryMetricText(row: ParsedReportStockRow, metric: RankMetric): string {
  return metric === "fiveDay" ? formatSignedPercent(row.recentFiveDayReturn) : formatChange(row.changeText);
}

function getSecondaryMetricText(row: ParsedReportStockRow, metric: RankMetric): string {
  return metric === "fiveDay" ? `今日 ${formatChange(row.changeText)}` : row.closeText;
}

function RankGridCard(props: {
  section: RankSection;
  universeRows: ParsedReportStockRow[];
}) {
  const { section, universeRows } = props;

  return (
    <section className="rounded-2xl border border-border/80 bg-background/35 p-4">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          <p className="text-xs leading-5 text-muted-foreground">{section.description}</p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          Top {section.rows.length}
        </span>
      </div>

      {section.rows.length === 0 ? (
        <div className="py-6 text-sm text-muted-foreground">暂无可用数据。</div>
      ) : (
        <ol className="divide-y divide-border/60">
          {section.rows.map((row, index) => {
            const href = buildRowHref(row, universeRows, section.metric);
            const compareTarget = pickComparisonCandidate(row, universeRows, section.metric);
            const primaryMetricValue = getPrimaryMetricValue(row, section.metric);

            return (
              <li key={`${section.title}-${row.symbol ?? row.company}-${index}`} className="py-3">
                <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/60 text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="truncate text-sm">{renderCompanyLink(row, href)}</div>
                    <p className="truncate text-xs text-muted-foreground">{(row.symbol ?? row.code) || "未映射代码"}</p>
                    {section.meta ? <p className="text-xs text-muted-foreground">{section.meta(row)}</p> : null}
                    {compareTarget?.symbol && href && row.detailUrl ? (
                      <Link href={href} className="inline-flex text-xs font-medium text-primary hover:underline">
                        对比 {compareTarget.company}
                      </Link>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-semibold ${metricTextClass(primaryMetricValue)}`}>
                      {getPrimaryMetricText(row, section.metric)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{getSecondaryMetricText(row, section.metric)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function HomeMoversPanel(props: { rows: ParsedReportStockRow[] }) {
  const ranked = useMemo(() => rankRows(props.rows), [props.rows]);
  const groups = useMemo(
    () =>
      [
        {
          title: "当日异动",
          description: "聚焦当天涨跌、波动和新闻热度，适合快速判断盘面焦点。",
          sections: [
            {
              title: "涨幅居前",
              rows: ranked.gainers,
              metric: "change",
              description: "当日涨幅最高的股票。"
            },
            {
              title: "跌幅居前",
              rows: ranked.decliners,
              metric: "change",
              description: "当日跌幅最大的股票。"
            },
            {
              title: "波动关注",
              rows: ranked.swings,
              metric: "change",
              description: "绝对涨跌幅最大，适合观察情绪冲击。"
            },
            {
              title: "新闻最多",
              rows: ranked.mostMentioned,
              metric: "change",
              description: "新闻曝光最多，便于追踪催化。",
              meta: (row: ParsedReportStockRow) => `${row.newsCount ?? 0} 条相关新闻`
            },
            {
              title: "连续上涨",
              rows: ranked.streakUp,
              metric: "change",
              description: "短期走势连续走强。",
              meta: (row: ParsedReportStockRow) => `已连涨 ${row.streak?.count ?? 0} 天`
            },
            {
              title: "连续下跌",
              rows: ranked.streakDown,
              metric: "change",
              description: "短期走势连续承压。",
              meta: (row: ParsedReportStockRow) => `已连跌 ${row.streak?.count ?? 0} 天`
            }
          ] satisfies RankSection[]
        },
        {
          title: "近 5 日跟踪",
          description: "关注短周期强弱、持续性和消息累积，更适合连续观察。",
          sections: [
            {
              title: "近 5 日最强",
              rows: ranked.strongestFiveDay,
              metric: "fiveDay",
              description: "5 日累计表现最强。",
              meta: (row: ParsedReportStockRow) => `区间收益 ${formatSignedPercent(row.recentFiveDayReturn)}`
            },
            {
              title: "近 5 日最弱",
              rows: ranked.weakestFiveDay,
              metric: "fiveDay",
              description: "5 日累计表现最弱。",
              meta: (row: ParsedReportStockRow) => `区间收益 ${formatSignedPercent(row.recentFiveDayReturn)}`
            },
            {
              title: "近 5 日消息最多",
              rows: ranked.mostMentionedFiveDay,
              metric: "fiveDay",
              description: "5 日内新闻密度最高。",
              meta: (row: ParsedReportStockRow) => `${row.recentFiveDayNewsCount ?? 0} 条近 5 日新闻`
            },
            {
              title: "近 5 日持续走强",
              rows: ranked.sustainedStrengthFiveDay,
              metric: "fiveDay",
              description: "上涨天数和区间收益同时占优。",
              meta: (row: ParsedReportStockRow) => `${row.recentPositiveDays ?? 0}/5 日上涨`
            },
            {
              title: "近 5 日持续走弱",
              rows: ranked.sustainedWeaknessFiveDay,
              metric: "fiveDay",
              description: "下跌天数和区间收益同时偏弱。",
              meta: (row: ParsedReportStockRow) => `${row.recentNegativeDays ?? 0}/5 日下跌`
            }
          ] satisfies RankSection[]
        }
      ] as const,
    [ranked]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/80 bg-card/90 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Leaderboards</p>
            <div>
              <h2 className="text-xl font-semibold text-foreground">异动榜</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                用更扁平的榜单视图快速浏览当日强弱、波动和近 5 日持续性。
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">样本股票</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{props.rows.length}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">当日榜单</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{groups[0].sections.length}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">5 日榜单</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{groups[1].sections.length}</p>
            </div>
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </div>
            <p className="text-xs text-muted-foreground">{group.sections.length} 个榜单</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.sections.map((section) => (
              <RankGridCard key={section.title} section={section} universeRows={props.rows} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
