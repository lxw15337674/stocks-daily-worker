"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { HomeMoversPanel } from "@/components/home-movers-panel";
import { ReportStockTable } from "@/components/report-stock-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getChangeTextClass, getChangeToneBadgeClass } from "@/lib/change-color";
import type { Language } from "@/lib/i18n";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type FeatureTone = "positive" | "negative" | "neutral";

type HomeContentTabsProps = {
  lang: Language;
  date: string;
  readableDate: string;
  rows: ParsedReportStockRow[];
  overview: string | null;
  newsGroups: Array<{
    symbol: string;
    displayName: string;
    changePct: number | null;
    detailUrl: string;
    items: Array<{
      title: string;
      link: string;
      source: string;
      publishedAt: string;
    }>;
  }>;
  reportMeta: {
    generatedAt?: string;
    sampleScope?: string;
    validQuotes?: string;
  };
};

type FeaturedStock = {
  row: ParsedReportStockRow;
  label: string;
  summary: string;
  score: number;
  tone: FeatureTone;
};

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toneClass(lang: Language, tone: FeatureTone): string {
  return getChangeToneBadgeClass(lang, tone);
}

function pickFeaturedStocks(rows: ParsedReportStockRow[], t: TFunction<"stocks">): FeaturedStock[] {
  return rows
    .filter((row) => row.symbol && row.detailUrl)
    .map((row) => {
      const change = row.changeValue ?? 0;
      const absChange = Math.abs(change);
      const newsCount = row.newsCount ?? 0;
      const streakCount = row.streak?.count ?? 0;
      const fiveDayReturn = row.recentFiveDayReturn ?? 0;
      const score = absChange * 4 + newsCount * 1.8 + Math.max(streakCount - 1, 0) * 1.5 + Math.abs(fiveDayReturn) * 0.65;

      let label = t("home.labels.todayWatch");
      let summary = t("home.summaries.default", { company: row.company, changeText: row.changeText || "-" });
      let tone: FeatureTone = change > 0 ? "positive" : change < 0 ? "negative" : "neutral";

      if (newsCount >= 3 || (row.recentFiveDayNewsCount ?? 0) >= 5) {
        label = t("home.labels.newsDriven");
        summary = t("home.summaries.newsDriven", {
          company: row.company,
          newsCount,
          changeText: row.changeText || "-"
        });
      } else if (row.streak?.direction === "up" && streakCount >= 3) {
        label = t("home.labels.sustainedStrength");
        summary = t("home.summaries.streakUp", {
          company: row.company,
          streakCount,
          changeText: row.changeText || "-"
        });
        tone = "positive";
      } else if (row.streak?.direction === "down" && streakCount >= 3) {
        label = t("home.labels.sustainedWeakness");
        summary = t("home.summaries.streakDown", {
          company: row.company,
          streakCount,
          changeText: row.changeText || "-"
        });
        tone = "negative";
      } else if (Math.abs(fiveDayReturn) >= 8) {
        label = fiveDayReturn > 0 ? t("home.labels.fiveDayStrength") : t("home.labels.fiveDayPullback");
        summary = t("home.summaries.fiveDay", {
          company: row.company,
          fiveDayReturnText: formatSignedPercent(row.recentFiveDayReturn),
          changeText: row.changeText || "-"
        });
        tone = fiveDayReturn > 0 ? "positive" : "negative";
      } else if (absChange >= 3) {
        label = t("home.labels.singleDayMove");
        summary = t("home.summaries.singleDayMove", {
          company: row.company,
          changeText: row.changeText || "-"
        });
      }

      return { row, label, summary, score, tone };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.abs(b.row.changeValue ?? 0) - Math.abs(a.row.changeValue ?? 0) ||
        (b.row.newsCount ?? 0) - (a.row.newsCount ?? 0)
    )
    .slice(0, 4);
}

function formatReportTime(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    timeZone: lang === "zh" ? "Asia/Shanghai" : "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function HomeContentTabs(props: HomeContentTabsProps) {
  const { lang, date, readableDate, rows, overview, newsGroups, reportMeta } = props;
  const { t } = useTranslation("stocks");
  const featuredStocks = useMemo(() => pickFeaturedStocks(rows, t), [rows, t]);

  return (
    <div className="home-content-stack">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-start">
        <div className="space-y-4">
          <Card className="bg-card/90">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("home.dailyFocus")}</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{t("home.featuredTitle")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("home.featuredDescription")}</p>
                </div>
                <Badge variant="outline">{t("home.featuredCount", { count: featuredStocks.length })}</Badge>
              </div>

              {featuredStocks.length === 0 ? (
                <Empty className="mt-4 border border-dashed border-border/70 bg-background/20 py-8">
                  <EmptyHeader>
                    <EmptyTitle>{t("home.featuredEmpty")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {featuredStocks.map((item) => (
                    <Card key={item.row.symbol ?? item.row.company} size="sm" className="bg-background/45">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1  font-medium ${toneClass(lang, item.tone)}`}>
                                {item.label}
                              </span>
                              {item.row.businessType ? (
                                <span className=" text-muted-foreground">{item.row.businessType}</span>
                              ) : null}
                            </div>
                            <Link href={item.row.detailUrl ?? "#"} className="mt-3 block text-base font-medium text-foreground hover:text-primary">
                              {item.row.company}
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground">{item.row.symbol ?? item.row.code}</p>
                          </div>

                          <div className="text-right">
                            <p className={`text-lg font-semibold ${item.row.changeValue === null ? "text-foreground" : getChangeTextClass(lang, item.row.changeValue)}`}>
                              {item.row.changeText || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.row.closeText}</p>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-foreground/90">{item.summary}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                            {t("home.fiveDayLabel")}: {formatSignedPercent(item.row.recentFiveDayReturn)}
                          </span>
                          <span className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                            {t("home.newsLabel", { count: item.row.newsCount ?? 0 })}
                          </span>
                          <span className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                            {item.row.streak?.direction === "up"
                              ? t("home.streakUp", { count: item.row.streak.count })
                              : item.row.streak?.direction === "down"
                                ? t("home.streakDown", { count: item.row.streak.count })
                                : t("home.noStreak")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-2xl">{date}</CardTitle>
                  <p className="meta mt-1">{t("home.tradingDate")}: {readableDate}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t("home.fullReport")}</Badge>
                  {reportMeta.generatedAt ? <Badge variant="outline">{formatReportTime(reportMeta.generatedAt, lang)}</Badge> : null}
                </div>
              </div>

              <div className="report-meta-row">
                {reportMeta.sampleScope ? <span className="report-meta-pill">{t("home.sampleScope")}: {reportMeta.sampleScope}</span> : null}
                {reportMeta.validQuotes ? <span className="report-meta-pill">{t("home.validQuotes")}: {reportMeta.validQuotes}</span> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <Card size="sm" className="bg-background/45">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-foreground">{t("home.morningBriefTitle")}</h3>
                      <Badge variant="secondary">{t("home.morningBriefBadge")}</Badge>
                    </div>
                    <Card size="sm" className="mt-4 bg-background/60">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {t("home.morningBriefEyebrow")}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-foreground/90">{overview ?? t("compare.noMorningBrief")}</p>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>

                <ReportStockTable
                  lang={lang}
                  rows={rows}
                  variant="embedded"
                  title={t("home.stockTableTitle")}
                  description={t("home.stockTableDescription")}
                  labels={{
                    company: t("compare.companyColumn"),
                    code: t("tableCode"),
                    close: t("tablePrice"),
                    change: t("tableChange24h")
                  }}
                />
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-foreground">{t("home.companyNewsTitle")}</h3>
                  <Badge variant="outline">{newsGroups.reduce((sum, group) => sum + group.items.length, 0)}</Badge>
                </div>

                {newsGroups.every((group) => group.items.length === 0) ? (
                  <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
                    <EmptyHeader>
                      <EmptyTitle>{t("home.noCompanyNews")}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {newsGroups
                      .filter((group) => group.items.length > 0)
                      .map((group) => (
                        <Card key={group.symbol} size="sm" className="bg-background/45">
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <Link href={group.detailUrl} className="font-medium text-foreground hover:text-primary">
                                  {group.displayName}
                                </Link>
                                <p className="mt-1 text-xs text-muted-foreground">{group.symbol}</p>
                              </div>
                              <Badge variant="secondary">
                                {group.changePct === null ? "-" : formatSignedPercent(group.changePct)}
                              </Badge>
                            </div>

                            <div className="mt-4 space-y-3">
                              {group.items.map((item) => (
                                <Card key={`${group.symbol}-${item.link}-${item.publishedAt}`} size="sm" className="bg-background/60">
                                  <CardContent className="p-3">
                                    <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-medium leading-6 text-foreground hover:text-primary">
                                      {item.title}
                                    </a>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {item.source} · {formatReportTime(item.publishedAt, lang)}
                                    </p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </section>
            </CardContent>
          </Card>
        </div>

        <div>
          <HomeMoversPanel lang={lang} rows={rows} />
        </div>
      </div>
    </div>
  );
}
