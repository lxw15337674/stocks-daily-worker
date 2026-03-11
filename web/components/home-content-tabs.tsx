"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Rss } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { HomeMoversPanel } from "@/components/home-movers-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type HomeContentTab = "report" | "movers";
type FeatureTone = "positive" | "negative" | "neutral";

type HomeContentTabsProps = {
  date: string;
  readableDate: string;
  markdown: string;
  rows: ParsedReportStockRow[];
  previousDate: string | null;
  nextDate: string | null;
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

const TAB_ITEMS: Array<{ value: HomeContentTab; label: string }> = [
  { value: "report", label: "日报正文" },
  { value: "movers", label: "异动榜" }
];

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

function pickFeaturedStocks(rows: ParsedReportStockRow[]): FeaturedStock[] {
  return rows
    .filter((row) => row.symbol && row.detailUrl)
    .map((row) => {
      const change = row.changeValue ?? 0;
      const absChange = Math.abs(change);
      const newsCount = row.newsCount ?? 0;
      const streakCount = row.streak?.count ?? 0;
      const fiveDayReturn = row.recentFiveDayReturn ?? 0;
      const score = absChange * 4 + newsCount * 1.8 + Math.max(streakCount - 1, 0) * 1.5 + Math.abs(fiveDayReturn) * 0.65;

      let label = "今日值得看";
      let summary = `${row.company} 今日录得 ${row.changeText || "-"}，适合从盘中强弱和新闻反馈继续跟踪。`;
      let tone: FeatureTone = change > 0 ? "positive" : change < 0 ? "negative" : "neutral";

      if (newsCount >= 3 || (row.recentFiveDayNewsCount ?? 0) >= 5) {
        label = "消息驱动";
        summary = `${row.company} 当日相关新闻达到 ${newsCount} 条，价格表现为 ${row.changeText || "-"}，适合优先确认消息催化是否还在发酵。`;
      } else if (row.streak?.direction === "up" && streakCount >= 3) {
        label = "连续走强";
        summary = `${row.company} 已连涨 ${streakCount} 天，今日继续收在 ${row.changeText || "-"}，更像是趋势延续而非单日脉冲。`;
        tone = "positive";
      } else if (row.streak?.direction === "down" && streakCount >= 3) {
        label = "连续承压";
        summary = `${row.company} 已连跌 ${streakCount} 天，今日表现 ${row.changeText || "-"}，需要判断是阶段回撤还是热度退潮。`;
        tone = "negative";
      } else if (Math.abs(fiveDayReturn) >= 8) {
        label = fiveDayReturn > 0 ? "区间走强" : "区间回撤";
        summary = `${row.company} 近 5 日累计 ${formatSignedPercent(row.recentFiveDayReturn)}，今天为 ${row.changeText || "-"}，适合结合短周期强弱继续观察。`;
        tone = fiveDayReturn > 0 ? "positive" : "negative";
      } else if (absChange >= 3) {
        label = "单日异动";
        summary = `${row.company} 当日波动达到 ${row.changeText || "-"}，已经进入固定股票池里值得复盘的显著变动区间。`;
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
}) {
  const { href, direction } = props;
  const label = direction === "previous" ? "前一天" : "后一天";

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

export function HomeContentTabs(props: HomeContentTabsProps) {
  const { date, readableDate, markdown, rows, previousDate, nextDate, reportMeta } = props;
  const [activeTab, setActiveTab] = useState<HomeContentTab>("report");
  const featuredStocks = useMemo(() => pickFeaturedStocks(rows), [rows]);

  function toDateHref(targetDate: string | null): string | null {
    return targetDate ? `/?date=${targetDate}` : null;
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as HomeContentTab)}
      className="home-content-stack"
    >
      <div className="home-tabs-bar">
        <TabsList className="home-tabs-list" aria-label="首页主功能切换">
          {TAB_ITEMS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="home-tabs-trigger">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="home-tabs-toolbar">
          <DateNavButton href={toDateHref(previousDate)} direction="previous" />
          <form className="home-date-form" action="/" method="get">
            <Input
              id="detail-report-date"
              name="date"
              type="date"
              defaultValue={date}
              required
              className="home-date-input"
              aria-label="选择交易日"
            />
            <Button type="submit" variant="secondary" size="sm" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              跳转
            </Button>
          </form>
          <DateNavButton href={toDateHref(nextDate)} direction="next" />
        </div>
      </div>

      <TabsContent value="report" className="mt-0 space-y-4">
        <section className="rounded-2xl border border-border/80 bg-card/90 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Daily Focus</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">今日重点股票</h2>
              <p className="mt-1 text-sm text-muted-foreground">从固定股票池里挑出今天最值得先看的几只，先看它们，再决定深入哪一页。</p>
            </div>
            <Badge variant="outline">{featuredStocks.length} 只重点跟踪</Badge>
          </div>

          {featuredStocks.length === 0 ? (
            <p className="empty mt-4">当前样本不足，暂时无法生成重点股票。</p>
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
                      5 日: {formatSignedPercent(item.row.recentFiveDayReturn)}
                    </span>
                    <span className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                      新闻: {item.row.newsCount ?? 0} 条
                    </span>
                    <span className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                      {item.row.streak?.direction === "up"
                        ? `连涨 ${item.row.streak.count} 天`
                        : item.row.streak?.direction === "down"
                          ? `连跌 ${item.row.streak.count} 天`
                          : "暂无连续信号"}
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
                <p className="meta mt-1">美东交易日：{readableDate}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">完整日报</Badge>
                {reportMeta.generatedAt ? <Badge variant="outline">{reportMeta.generatedAt}</Badge> : null}
              </div>
            </div>

            <div className="report-meta-row">
              {reportMeta.sampleScope ? <span className="report-meta-pill">样本范围：{reportMeta.sampleScope}</span> : null}
              {reportMeta.validQuotes ? <span className="report-meta-pill">有效行情：{reportMeta.validQuotes}</span> : null}
              <div className="report-feed-links">
                <a href="/rss.xml">
                  <Rss className="h-3.5 w-3.5" />
                  RSS
                </a>
                <a href="/atom.xml">Atom</a>
                <a href="/feed.json">JSON Feed</a>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <article className="markdown-body report-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="movers" className="mt-0">
        <HomeMoversPanel rows={rows} />
      </TabsContent>
    </Tabs>
  );
}
