import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Newspaper, Rss, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchReportByDate, fetchReportList, type ReportListItem } from "@/lib/api";
import { addDaysToReportDate, isValidReportDate, toReadableDate } from "@/lib/date";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type HomePageProps = {
  searchParams: Promise<{ date?: string }>;
};

type ReportMeta = {
  generatedAt?: string;
  sampleScope?: string;
  validQuotes?: string;
};

function getTodayEtDateString(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function extractReportMeta(markdown: string): ReportMeta {
  const generatedAt = markdown.match(/^>\s*生成时间：(.+)$/m)?.[1]?.trim();
  const sampleScope = markdown.match(/^>\s*样本范围：(.+)$/m)?.[1]?.trim();
  const validQuotes = markdown.match(/^>\s*有效行情：(.+)$/m)?.[1]?.trim();
  return { generatedAt, sampleScope, validQuotes };
}

function pickRecentDates(items: ReportListItem[], currentDate: string): string[] {
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const item of items) {
    if (seen.has(item.reportDateEt)) {
      continue;
    }
    seen.add(item.reportDateEt);
    if (item.reportDateEt !== currentDate) {
      dates.push(item.reportDateEt);
    }
    if (dates.length >= 14) {
      break;
    }
  }
  return dates;
}

function toDateHref(targetDate: string | null): string {
  return targetDate ? `/?date=${targetDate}` : "/";
}

export default async function HomePage(props: HomePageProps) {
  const { date: queryDateRaw } = await props.searchParams;
  const queryDate = queryDateRaw?.trim() ?? "";
  
  // 确定要显示的日期
  let date: string;
  if (isValidReportDate(queryDate)) {
    date = queryDate;
  } else {
    // 没有有效的查询日期，获取最新的日报日期
    const history = await fetchReportList(1);
    date = history[0]?.reportDateEt ?? getTodayEtDateString();
  }

  const [markdown, history] = await Promise.all([fetchReportByDate(date), fetchReportList(120)]);
  if (!markdown) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>未找到对应日报</CardTitle>
            <p className="meta mt-1">请确认日期格式为 YYYY-MM-DD，并且该交易日已经生成报告。</p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const previousDate = addDaysToReportDate(date, -1);
  const nextDate = addDaysToReportDate(date, 1);
  const recentDates = pickRecentDates(history, date);
  const reportMeta = extractReportMeta(markdown);

  return (
    <main className="page-shell">
      <div className="report-layout">
        <aside className="report-left">
          <Card className="report-sticky">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">日期导航</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        </aside>

        <section className="report-main">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-2xl">{date}</CardTitle>
                  <p className="meta mt-1">美东交易日：{toReadableDate(date)}</p>
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
        </section>

        <aside className="report-right">
          <Card className="report-sticky">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">信息面板</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="feed-list">
                <a href="/rss.xml">
                  <Rss className="mr-2 inline h-3.5 w-3.5" />
                  RSS 2.0
                </a>
                <a href="/atom.xml">Atom 1.0</a>
                <a href="/feed.json">JSON Feed</a>
              </div>

              <div className="space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/archive">
                    <Newspaper className="h-4 w-4" />
                    历史日报
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/stocks">
                    <Settings2 className="h-4 w-4" />
                    股票管理
                  </Link>
                </Button>
                <Button asChild size="sm" className="w-full">
                  <Link href="/">回到今天</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
