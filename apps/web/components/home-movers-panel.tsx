"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { pickBestCompareTarget } from "@/lib/compare-target";
import type { Language } from "@/lib/i18n";
import { assetInstrumentPath } from "@/lib/platform-routes";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type RankMetric = "change" | "fiveDay";

type RankMetaType = "newsCount" | "streakUp" | "streakDown" | "fiveDayReturn" | "recentFiveDayNewsCount" | "recentPositiveDays" | "recentNegativeDays";

type RankSection = {
  title: string;
  rows: ParsedReportStockRow[];
  metric: RankMetric;
  description: string;
  metaType?: RankMetaType;
};

type MoversGroupCopy = {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    description: string;
    metaType?: RankMetaType;
  }>;
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

function buildCompareDetailUrl(lang: Language, symbol: string | null, compareSymbol: string | null): string | null {
  if (!symbol) {
    return null;
  }

  const base = assetInstrumentPath(lang, "stocks", symbol);
  return compareSymbol ? `${base}?compare=${encodeURIComponent(compareSymbol)}` : base;
}

function pickComparisonCandidate(
  row: ParsedReportStockRow,
  rows: ParsedReportStockRow[],
  metric: RankMetric
): ParsedReportStockRow | null {
  return pickBestCompareTarget(row, rows, metric);
}

function buildRowHrefForLanguage(
  lang: Language,
  row: ParsedReportStockRow,
  rows: ParsedReportStockRow[],
  metric: RankMetric
): string | null {
  if (!row.detailUrl) {
    return row.xueqiuUrl;
  }

  const compareTarget = pickComparisonCandidate(row, rows, metric);
  return buildCompareDetailUrl(lang, row.symbol, compareTarget?.symbol ?? null) ?? row.detailUrl;
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
  return metric === "fiveDay" ? formatChange(row.changeText) : row.closeText;
}

function getMetaText(
  t: TFunction<"stocks">,
  metaType: RankSection["metaType"],
  row: ParsedReportStockRow
): string | null {
  if (!metaType) {
    return null;
  }

  switch (metaType) {
    case "newsCount":
      return t("movers.newsCount", { count: row.newsCount ?? 0 });
    case "streakUp":
      return t("movers.streakUp", { count: row.streak?.count ?? 0 });
    case "streakDown":
      return t("movers.streakDown", { count: row.streak?.count ?? 0 });
    case "fiveDayReturn":
      return t("movers.fiveDayReturn", { value: formatSignedPercent(row.recentFiveDayReturn) });
    case "recentFiveDayNewsCount":
      return t("movers.recentFiveDayNewsCount", { count: row.recentFiveDayNewsCount ?? 0 });
    case "recentPositiveDays":
      return t("movers.recentPositiveDays", { count: row.recentPositiveDays ?? 0 });
    case "recentNegativeDays":
      return t("movers.recentNegativeDays", { count: row.recentNegativeDays ?? 0 });
    default:
      return null;
  }
}

function RankGridCard(props: {
  lang: Language;
  section: RankSection;
  universeRows: ParsedReportStockRow[];
  t: TFunction<"stocks">;
}) {
  const { lang, section, universeRows, t } = props;

  return (
    <section className="rounded-2xl border border-border/80 bg-background/35 p-4">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          <p className="text-xs leading-5 text-muted-foreground">{section.description}</p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          {t("movers.topCount", { count: section.rows.length })}
        </span>
      </div>

      {section.rows.length === 0 ? (
        <div className="py-6 text-sm text-muted-foreground">{t("movers.noData")}</div>
      ) : (
        <ol className="divide-y divide-border/60">
          {section.rows.map((row, index) => {
            const href = buildRowHrefForLanguage(lang, row, universeRows, section.metric);
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
                    <p className="truncate text-xs text-muted-foreground">{(row.symbol ?? row.code) || t("movers.unmappedCode")}</p>
                    {section.metaType ? <p className="text-xs text-muted-foreground">{getMetaText(t, section.metaType, row)}</p> : null}
                    {compareTarget?.symbol && href && row.detailUrl ? (
                      <Link href={href} className="inline-flex text-xs font-medium text-primary hover:underline">
                        {t("movers.compareWith", { company: compareTarget.company })}
                      </Link>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-semibold ${metricTextClass(primaryMetricValue)}`}>
                      {getPrimaryMetricText(row, section.metric)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {section.metric === "fiveDay"
                        ? t("movers.currentDayMetric", { value: getSecondaryMetricText(row, section.metric) })
                        : getSecondaryMetricText(row, section.metric)}
                    </p>
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

export function HomeMoversPanel(props: { lang: Language; rows: ParsedReportStockRow[] }) {
  const { t } = useTranslation("stocks");
  const ranked = useMemo(() => rankRows(props.rows), [props.rows]);
  const copyGroups = useMemo(() => t("movers.groups", { returnObjects: true }) as MoversGroupCopy[], [t]);
  const groups = useMemo(
    () =>
      copyGroups.map((group, groupIndex) => ({
        title: group.title,
        description: group.description,
        sections: group.sections.map((section, sectionIndex) => ({
          title: section.title,
          description: section.description,
          metric: (groupIndex === 0 ? "change" : "fiveDay") as RankMetric,
          rows:
            groupIndex === 0
              ? [ranked.gainers, ranked.decliners, ranked.swings, ranked.mostMentioned, ranked.streakUp, ranked.streakDown][sectionIndex]
              : [
                  ranked.strongestFiveDay,
                  ranked.weakestFiveDay,
                  ranked.mostMentionedFiveDay,
                  ranked.sustainedStrengthFiveDay,
                  ranked.sustainedWeaknessFiveDay
                ][sectionIndex],
          metaType: section.metaType
        }))
      })),
    [copyGroups, ranked]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/80 bg-card/90 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("movers.leaderboards")}</p>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{t("movers.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("movers.description")}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("movers.sampleStocks")}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{props.rows.length}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("movers.currentDayBoards")}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{groups[0].sections.length}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("movers.fiveDayBoards")}</p>
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
            <p className="text-xs text-muted-foreground">{t("movers.boardCount", { count: group.sections.length })}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.sections.map((section) => (
                  <RankGridCard key={section.title} lang={props.lang} section={section} universeRows={props.rows} t={t} />
                ))}
              </div>
        </section>
      ))}
    </div>
  );
}
