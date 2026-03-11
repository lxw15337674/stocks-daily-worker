"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pickBestCompareTarget } from "@/lib/compare-target";
import type { ParsedReportStockRow } from "@/lib/report-parser";

function changeTextClass(value: number | null): string {
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

function formatFiveDayReturn(value: number | null | undefined): string {
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
  metric: "change" | "fiveDay"
): ParsedReportStockRow | null {
  return pickBestCompareTarget(row, rows, metric);
}

function buildRowHref(row: ParsedReportStockRow, rows: ParsedReportStockRow[], metric: "change" | "fiveDay"): string | null {
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
        <a href={href} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">
          {row.company}
        </a>
      );
    }

    return (
      <Link href={href} className="font-medium hover:text-primary">
        {row.company}
      </Link>
    );
  }

  if (row.xueqiuUrl) {
    return (
      <a href={row.xueqiuUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">
        {row.company}
      </a>
    );
  }

  return <span className="font-medium">{row.company}</span>;
}

function RankList(props: {
  title: string;
  rows: ParsedReportStockRow[];
  universeRows: ParsedReportStockRow[];
  metric: "change" | "fiveDay";
  meta?: (row: ParsedReportStockRow) => string | null;
}) {
  const { title, rows, universeRows, metric, meta } = props;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-xs text-muted-foreground">{rows.length} 只</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">暂无可用行情。</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const compareTarget = pickComparisonCandidate(row, universeRows, metric);
            const href = buildRowHref(row, universeRows, metric);

            return (
              <div key={`${title}-${row.symbol ?? row.company}-${index}`} className="rounded-xl border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {renderCompanyLink(row, href)}
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {meta?.(row) ?? ((row.symbol ?? row.code) || "未映射代码")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${changeTextClass(row.changeValue)}`}>{formatChange(row.changeText)}</p>
                    <p className="text-xs text-muted-foreground">{row.closeText}</p>
                  </div>
                </div>
                {row.detailUrl && href && compareTarget?.symbol ? (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border/80 bg-background/30 px-2.5 py-2">
                    <span className="text-[11px] text-muted-foreground">默认对比 {compareTarget.company}</span>
                    <Link href={href} className="text-xs font-medium text-primary hover:underline">
                      进入详情
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function HomeMoversPanel(props: { rows: ParsedReportStockRow[] }) {
  const ranked = rankRows(props.rows);
  const groups: Array<{
    title: string;
    description: string;
    sections: Array<{
      title: string;
      rows: ParsedReportStockRow[];
      metric: "change" | "fiveDay";
      meta?: (row: ParsedReportStockRow) => string | null;
      defaultOpen?: boolean;
    }>;
  }> = [
    {
      title: "当日异动",
      description: "围绕当天涨跌、波动和新闻热度，适合快速判断盘面焦点。",
      sections: [
        { title: "涨幅居前", rows: ranked.gainers, metric: "change", defaultOpen: true },
        { title: "跌幅居前", rows: ranked.decliners, metric: "change", defaultOpen: true },
        { title: "波动关注", rows: ranked.swings, metric: "change", defaultOpen: true },
        { title: "新闻最多", rows: ranked.mostMentioned, metric: "change", meta: (row) => `${row.newsCount ?? 0} 条相关新闻` },
        { title: "连续上涨", rows: ranked.streakUp, metric: "change", meta: (row) => `已连涨 ${row.streak?.count ?? 0} 天` },
        { title: "连续下跌", rows: ranked.streakDown, metric: "change", meta: (row) => `已连跌 ${row.streak?.count ?? 0} 天` }
      ]
    },
    {
      title: "近 5 日跟踪",
      description: "围绕短周期强弱、持续性和消息累积，更适合做连续跟踪。",
      sections: [
        {
          title: "近 5 日最强",
          rows: ranked.strongestFiveDay,
          metric: "fiveDay",
          meta: (row) => `5 日收益 ${formatFiveDayReturn(row.recentFiveDayReturn)}`
        },
        {
          title: "近 5 日最弱",
          rows: ranked.weakestFiveDay,
          metric: "fiveDay",
          meta: (row) => `5 日收益 ${formatFiveDayReturn(row.recentFiveDayReturn)}`
        },
        {
          title: "近 5 日消息最多",
          rows: ranked.mostMentionedFiveDay,
          metric: "fiveDay",
          meta: (row) => `${row.recentFiveDayNewsCount ?? 0} 条近 5 日新闻`
        },
        {
          title: "近 5 日持续走强",
          rows: ranked.sustainedStrengthFiveDay,
          metric: "fiveDay",
          meta: (row) => `${row.recentPositiveDays ?? 0}/5 日上涨，区间 ${formatFiveDayReturn(row.recentFiveDayReturn)}`
        },
        {
          title: "近 5 日持续走弱",
          rows: ranked.sustainedWeaknessFiveDay,
          metric: "fiveDay",
          meta: (row) => `${row.recentNegativeDays ?? 0}/5 日下跌，区间 ${formatFiveDayReturn(row.recentFiveDayReturn)}`
        }
      ]
    }
  ];

  const totalSectionCount = groups.reduce((sum, group) => sum + group.sections.length, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">异动榜</CardTitle>
          <span className="text-xs text-muted-foreground">{totalSectionCount} 个跟踪维度</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => (
          <section key={group.title} className="space-y-3 rounded-2xl border bg-background/20 p-3">
            <div className="space-y-1 px-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{group.title}</p>
                <span className="text-xs text-muted-foreground">{group.sections.length} 个榜单</span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{group.description}</p>
            </div>

            {group.sections.map((section) => (
              <details
                key={section.title}
                open={section.defaultOpen === true}
                className="group rounded-xl border bg-background/30 p-3 open:bg-background/40"
              >
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none">
                  <div className="flex items-center justify-between gap-3">
                    <span>{section.title}</span>
                    <span className="text-xs text-muted-foreground transition group-open:rotate-180">⌄</span>
                  </div>
                </summary>
                <div className="mt-3">
                  <RankList
                    title={section.title}
                    rows={section.rows}
                    universeRows={props.rows}
                    metric={section.metric}
                    meta={section.meta}
                  />
                </div>
              </details>
            ))}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
