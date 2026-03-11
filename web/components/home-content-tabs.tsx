"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Rss } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { FavoriteStocksPanel } from "@/components/favorite-stocks-panel";
import { HomeMoversPanel } from "@/components/home-movers-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StockListItem } from "@/lib/api";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type HomeContentTab = "report" | "favorites" | "movers";

type HomeContentTabsProps = {
  date: string;
  readableDate: string;
  markdown: string;
  rows: ParsedReportStockRow[];
  stockItems: StockListItem[];
  previousDate: string | null;
  nextDate: string | null;
  recentDates: string[];
  reportMeta: {
    generatedAt?: string;
    sampleScope?: string;
    validQuotes?: string;
  };
};

const TAB_ITEMS: Array<{ value: HomeContentTab; label: string }> = [
  { value: "report", label: "日报正文" },
  { value: "favorites", label: "我的关注池" },
  { value: "movers", label: "异动榜" }
];

export function HomeContentTabs(props: HomeContentTabsProps) {
  const { date, readableDate, markdown, rows, stockItems, previousDate, nextDate, recentDates, reportMeta } = props;
  const [activeTab, setActiveTab] = useState<HomeContentTab>("report");

  function toDateHref(targetDate: string | null): string {
    return targetDate ? `/?date=${targetDate}` : "/";
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
      </div>

      <TabsContent value="report" className="mt-0">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">日报导航</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="report-nav-grid">
                <form className="space-y-2" action="/" method="get">
                  <label htmlFor="detail-report-date" className="text-sm text-muted-foreground">
                    跳转到指定交易日
                  </label>
                  <Input id="detail-report-date" name="date" type="date" defaultValue={date} required />
                  <Button type="submit" variant="secondary" size="sm" className="w-full gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    跳转日期
                  </Button>
                </form>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" disabled={!previousDate}>
                      <Link href={toDateHref(previousDate)}>
                        <ChevronLeft className="h-4 w-4" />
                        前一天
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" disabled={!nextDate}>
                      <Link href={toDateHref(nextDate)}>
                        后一天
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">最近日期</p>
                    {recentDates.length === 0 ? (
                      <p className="empty">暂无更多历史日期。</p>
                    ) : (
                      <div className="recent-date-list">
                        {recentDates.map((itemDate) => (
                          <Link key={itemDate} href={`/?date=${itemDate}`}>
                            {itemDate}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="report-nav-grid">
                <div className="meta-grid">
                  <div>
                    <span>报告日期</span>
                    <p>{date}</p>
                  </div>
                  {reportMeta.generatedAt ? (
                    <div>
                      <span>生成时间</span>
                      <p>{reportMeta.generatedAt}</p>
                    </div>
                  ) : null}
                  {reportMeta.sampleScope ? (
                    <div>
                      <span>样本范围</span>
                      <p>{reportMeta.sampleScope}</p>
                    </div>
                  ) : null}
                  {reportMeta.validQuotes ? (
                    <div>
                      <span>有效行情</span>
                      <p>{reportMeta.validQuotes}</p>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">订阅输出</p>
                  <div className="feed-list">
                    <a href="/rss.xml">
                      <Rss className="mr-2 inline h-3.5 w-3.5" />
                      RSS 2.0
                    </a>
                    <a href="/atom.xml">Atom 1.0</a>
                    <a href="/feed.json">JSON Feed</a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-2xl">{date}</CardTitle>
                  <p className="meta mt-1">美东交易日：{readableDate}</p>
                </div>
                <Badge variant="outline">完整日报</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <article className="markdown-body report-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="favorites" className="mt-0">
        <FavoriteStocksPanel rows={rows} stockItems={stockItems} />
      </TabsContent>
      <TabsContent value="movers" className="mt-0">
        <HomeMoversPanel rows={rows} />
      </TabsContent>
    </Tabs>
  );
}
