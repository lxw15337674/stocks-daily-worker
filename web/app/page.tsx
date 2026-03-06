"use client";

import Link from "next/link";
import { ArrowRight, BellRing, History, Rss } from "lucide-react";
import { useEffect, useState } from "react";

import { DateLookupForm } from "@/components/date-lookup-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchLatestMarkdown, fetchReportList, type ReportListItem } from "@/lib/public-api";
import { toReadableDate } from "@/lib/date";

function toExcerpt(markdown: string, maxChars: number): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(plain);
  if (chars.length <= maxChars) {
    return plain;
  }
  return `${chars.slice(0, maxChars).join("")}...`;
}

export default function HomePage() {
  const [latest, setLatest] = useState<{ markdown: string; fileName?: string } | null>(null);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let latestData: { markdown: string; fileName?: string } | null = null;
      let reportItems: ReportListItem[] = [];

      try {
        [latestData, reportItems] = await Promise.all([fetchLatestMarkdown(), fetchReportList(30)]);
      } catch {
        latestData = null;
        reportItems = [];
      }

      if (cancelled) {
        return;
      }
      setLatest(latestData);
      setReports(reportItems);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const latestDate = reports[0]?.reportDateEt;
  const latestExcerpt = loading ? "正在加载最新日报..." : latest ? toExcerpt(latest.markdown, 220) : "暂无最新日报内容。";

  return (
    <main className="page-shell">
      <section className="hero-card">
        <Badge variant="secondary" className="w-fit">
          China Stocks Daily
        </Badge>
        <h1 className="mt-3 text-3xl md:text-4xl">中概日报查询站</h1>
        <p className="hero-summary">支持按日期查看完整报告，日期统一采用美东交易日（YYYY-MM-DD）。</p>
        <DateLookupForm initialValue={latestDate} />
      </section>

      <section className="grid-two">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">最新摘要</CardTitle>
            <CardDescription>最近一次归档的快速预览</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">{latestExcerpt}</p>
            {latestDate ? <p className="meta">对应日期：{toReadableDate(latestDate)}</p> : null}
            {latestDate ? (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/report/${latestDate}`}>
                  查看完整内容
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BellRing className="h-5 w-5" />
              订阅与导航
            </CardTitle>
            <CardDescription>使用 feed 订阅或进入历史页</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="feed-list">
              <a href="/rss.xml">
                <Rss className="mr-2 inline h-3.5 w-3.5" />
                RSS 2.0
              </a>
              <a href="/atom.xml">Atom 1.0</a>
              <a href="/feed.json">JSON Feed</a>
            </div>
            <Button asChild variant="secondary" size="sm" className="mt-2 gap-2">
              <Link href="/archive">
                <History className="h-4 w-4" />
                浏览历史
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">最近历史</CardTitle>
          <CardDescription>点击日期进入完整日报</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="empty">正在加载历史记录...</p>
          ) : reports.length === 0 ? (
            <p className="empty">当前没有历史记录。</p>
          ) : (
            <ul className="report-list">
              {reports.slice(0, 12).map((item) => (
                <li key={`${item.reportDateEt}-${item.createdAt}`}>
                  <Link href={`/report/${item.reportDateEt}`}>{item.reportDateEt}</Link>
                  <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
