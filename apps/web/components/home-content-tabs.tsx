"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { HomeMoversPanel } from "@/components/home-movers-panel";
import { ReportStockTable } from "@/components/report-stock-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type HomeContentTab = "report" | "movers";
type FeatureTone = "positive" | "negative" | "neutral";

type HomeContentTabsProps = {
  lang: Language;
  date: string;
  readableDate: string;
  rows: ParsedReportStockRow[];
  previousDate: string | null;
  nextDate: string | null;
  overview: {
    stock: string | null;
    news: string | null;
  };
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

function toneClass(tone: FeatureTone): string {
  if (tone === "positive") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (tone === "negative") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  return "border-border/70 bg-background/50 text-muted-foreground";
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

function DateNavButton(props: {
  href: string | null;
  direction: "previous" | "next";
  t: TFunction<"stocks">;
}) {
  const { href, direction, t } = props;
  const label = direction === "previous" ? t("home.previousDay") : t("home.nextDay");

  if (!href) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        {direction === "previous" ? <ChevronLeft className="h-3.5 w-3.5" /> : null}
        {label}
        {direction === "next" ? <ChevronRight className="h-3.5 w-3.5" /> : null}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        {direction === "previous" ? <ChevronLeft className="h-3.5 w-3.5" /> : null}
        {label}
        {direction === "next" ? <ChevronRight className="h-3.5 w-3.5" /> : null}
      </Link>
    </Button>
  );
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
  const { lang, date, readableDate, rows, previousDate, nextDate, overview, newsGroups, reportMeta } = props;
  const { t } = useTranslation("stocks");
  const [activeTab, setActiveTab] = useState<HomeContentTab>("report");
  const featuredStocks = useMemo(() => pickFeaturedStocks(rows, t), [rows, t]);
  const tabItems: Array<{ value: HomeContentTab; label: string }> = [
    { value: "report", label: t("home.tabs.report") },
    { value: "movers", label: t("home.tabs.movers") }
  ];

  function toDateHref(targetDate: string | null): string | null {
    return targetDate ? `${assetHomePath(lang, "stocks")}?date=${encodeURIComponent(targetDate)}` : null;
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as HomeContentTab)}
      className="home-content-stack"
    >
      <div className="home-tabs-bar">
        <TabsList className="home-tabs-list" aria-label={t("home.tabsAriaLabel")}>
          {tabItems.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="home-tabs-trigger">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="home-tabs-toolbar">
          <DateNavButton href={toDateHref(previousDate)} direction="previous" t={t} />
          <form className="home-date-form" action={assetHomePath(lang, "stocks")} method="get">
            <Input
              id="detail-report-date"
              name="date"
              type="date"
              defaultValue={date}
              required
              className="home-date-input"
              aria-label={t("home.chooseDate")}
            />
            <Button type="submit" variant="secondary" size="sm" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("home.jump")}
            </Button>
          </form>
          <DateNavButton href={toDateHref(nextDate)} direction="next" t={t} />
        </div>
      </div>

      <TabsContent value="report" className="mt-0 space-y-4">
        <section className="rounded-2xl border border-border/80 bg-card/90 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("home.dailyFocus")}</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">{t("home.featuredTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("home.featuredDescription")}</p>
            </div>
            <Badge variant="outline">{t("home.featuredCount", { count: featuredStocks.length })}</Badge>
          </div>

          {featuredStocks.length === 0 ? (
            <p className="empty mt-4">{t("home.featuredEmpty")}</p>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {featuredStocks.map((item) => (
                <article key={item.row.symbol ?? item.row.company} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass(item.tone)}`}>
                          {item.label}
                        </span>
                        {item.row.businessType ? (
                          <span className="text-[11px] text-muted-foreground">{item.row.businessType}</span>
                        ) : null}
                      </div>
                      <Link href={item.row.detailUrl ?? "#"} className="mt-3 block text-base font-medium text-foreground hover:text-primary">
                        {item.row.company}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{item.row.symbol ?? item.row.code}</p>
                    </div>

                    <div className="text-right">
                      <p className={`text-lg font-semibold ${item.row.changeValue && item.row.changeValue > 0 ? "text-red-400" : item.row.changeValue && item.row.changeValue < 0 ? "text-emerald-400" : "text-foreground"}`}>
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
                </article>
              ))}
            </div>
          )}
        </section>

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
              <section className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-foreground">{t("home.aiOverviewTitle")}</h3>
                  <Badge variant="secondary">{t("home.aiOverviewBadge")}</Badge>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("home.stockOverviewTitle")}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-foreground/90">
                      {overview.stock ?? t("compare.noStockOverview")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("home.newsOverviewTitle")}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-foreground/90">
                      {overview.news ?? t("compare.noNewsOverview")}
                    </p>
                  </div>
                </div>
              </section>

              <ReportStockTable
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
                <p className="empty">{t("home.noCompanyNews")}</p>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {newsGroups
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                      <article key={group.symbol} className="rounded-2xl border border-border/70 bg-background/45 p-4">
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
                            <div key={`${group.symbol}-${item.link}-${item.publishedAt}`} className="rounded-xl border border-border/60 bg-background/60 p-3">
                              <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-medium leading-6 text-foreground hover:text-primary">
                                {item.title}
                              </a>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {item.source} · {formatReportTime(item.publishedAt, lang)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="movers" className="mt-0">
        <HomeMoversPanel lang={lang} rows={rows} />
      </TabsContent>
    </Tabs>
  );
}
