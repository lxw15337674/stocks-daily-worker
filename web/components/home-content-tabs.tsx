"use client";

import Link from "next/link";
import { useState } from "react";
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

const TAB_ITEMS: Array<{ value: HomeContentTab; label: string }> = [
  { value: "report", label: "日报正文" },
  { value: "movers", label: "异动榜" }
];

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

      <TabsContent value="report" className="mt-0">
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
