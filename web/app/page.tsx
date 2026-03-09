import Link from "next/link";
import { ArrowLeftRight, CalendarDays, ChevronLeft, ChevronRight, Newspaper, Rss, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteStocksPanel } from "@/components/favorite-stocks-panel";
import { HomeMoversPanel } from "@/components/home-movers-panel";
import { ReportStockTable } from "@/components/report-stock-table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchReportByDate, fetchReportList, fetchStockDetail, fetchStockList, type ReportListItem } from "@/lib/api";
import { addDaysToReportDate, isValidReportDate, toReadableDate } from "@/lib/date";
import {
  extractReportMeta,
  parseCompanyNewsSections,
  parseReportStockTable,
  stripReportMetaQuoteBlock,
  type ParsedReportStockRow
} from "@/lib/report-parser";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type HomePageProps = {
  searchParams: Promise<{ date?: string }>;
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

function calculateLatestStreak(changeValues: Array<number | null>): { direction: "up" | "down" | "flat"; count: number } {
  const firstValid = changeValues.find((value) => value !== null) ?? null;
  if (firstValid === null) {
    return { direction: "flat", count: 0 };
  }
  if (firstValid === 0) {
    return { direction: "flat", count: 1 };
  }

  const direction = firstValid > 0 ? "up" : "down";
  let count = 0;
  for (const value of changeValues) {
    if (value === null) {
      break;
    }
    if (direction === "up" && value > 0) {
      count += 1;
      continue;
    }
    if (direction === "down" && value < 0) {
      count += 1;
      continue;
    }
    break;
  }

  return { direction, count };
}

function calculateRecentReturn(closeValues: number[], windowSize: number): number | null {
  if (closeValues.length < 2) {
    return null;
  }

  const ordered = closeValues.filter((value) => Number.isFinite(value));
  if (ordered.length < 2) {
    return null;
  }

  const window = ordered.slice(0, windowSize);
  if (window.length < 2) {
    return null;
  }

  const latest = window[0];
  const oldest = window[window.length - 1];
  if (!oldest) {
    return null;
  }

  return ((latest - oldest) / oldest) * 100;
}

function countDirectionalDays(changeValues: Array<number | null>, windowSize: number, direction: "up" | "down"): number {
  return changeValues
    .slice(0, windowSize)
    .filter((value) => value !== null)
    .filter((value) => (direction === "up" ? (value ?? 0) > 0 : (value ?? 0) < 0)).length;
}

function countRecentNewsByDays(publishedAtValues: string[], reportDate: string, windowDays: number): number {
  const reportEnd = new Date(`${reportDate}T23:59:59Z`);
  if (Number.isNaN(reportEnd.getTime())) {
    return 0;
  }

  const windowStart = reportEnd.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return publishedAtValues.filter((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    const timestamp = date.getTime();
    return timestamp >= windowStart && timestamp <= reportEnd.getTime();
  }).length;
}

export default async function HomePage(props: HomePageProps) {
  const { date: queryDateRaw } = await props.searchParams;
  const queryDate = queryDateRaw?.trim() ?? "";
  
  // 确定要显示的日期：如果没有指定日期，默认获取最新日报
  let date: string;
  if (isValidReportDate(queryDate)) {
    date = queryDate;
  } else {
    const history = await fetchReportList(1);
    date = history[0]?.reportDateEt ?? getTodayEtDateString();
  }

  const [reportResult, history, stockItems] = await Promise.all([fetchReportByDate(date), fetchReportList(120), fetchStockList()]);
  const markdown = reportResult.markdown;
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
  const displayMarkdown = stripReportMetaQuoteBlock(markdown);
  const parsedStockTable = parseReportStockTable(displayMarkdown, stockItems);
  const newsSections = parseCompanyNewsSections(displayMarkdown);
  const newsCountBySymbol = new Map(newsSections.map((item) => [item.symbol, item.newsCount]));
  const stockItemBySymbol = new Map(stockItems.map((item) => [item.symbol, item]));

  const tableSymbols = Array.from(
    new Set(
      (parsedStockTable?.rows ?? [])
        .map((row) => row.symbol)
        .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0)
    )
  );
  const stockDetails = await Promise.all(
    tableSymbols.map(async (symbol) => ({
      symbol,
      detail: await fetchStockDetail(symbol)
    }))
  );
  const streakBySymbol = new Map(
    stockDetails.map(({ symbol, detail }) => [
      symbol,
      calculateLatestStreak((detail?.history ?? []).map((item) => item.changePct))
    ])
  );
  const recentFiveDayReturnBySymbol = new Map(
    stockDetails.map(({ symbol, detail }) => [
      symbol,
      calculateRecentReturn((detail?.history ?? []).map((item) => item.close), 5)
    ])
  );
  const recentPositiveDaysBySymbol = new Map(
    stockDetails.map(({ symbol, detail }) => [
      symbol,
      countDirectionalDays((detail?.history ?? []).map((item) => item.changePct), 5, "up")
    ])
  );
  const recentNegativeDaysBySymbol = new Map(
    stockDetails.map(({ symbol, detail }) => [
      symbol,
      countDirectionalDays((detail?.history ?? []).map((item) => item.changePct), 5, "down")
    ])
  );
  const recentFiveDayNewsCountBySymbol = new Map(
    stockDetails.map(({ symbol, detail }) => [
      symbol,
      countRecentNewsByDays((detail?.recentNews ?? []).map((item) => item.publishedAt), date, 5)
    ])
  );

  const enhancedRows: ParsedReportStockRow[] =
    parsedStockTable?.rows.map((row) => ({
      ...row,
      businessType: row.symbol ? (stockItemBySymbol.get(row.symbol)?.businessType ?? null) : null,
      newsCount: row.symbol ? (newsCountBySymbol.get(row.symbol) ?? 0) : 0,
      streak: row.symbol ? (streakBySymbol.get(row.symbol) ?? { direction: "flat", count: 0 }) : { direction: "flat", count: 0 },
      recentFiveDayReturn: row.symbol ? (recentFiveDayReturnBySymbol.get(row.symbol) ?? null) : null,
      recentFiveDayNewsCount: row.symbol ? (recentFiveDayNewsCountBySymbol.get(row.symbol) ?? 0) : 0,
      recentPositiveDays: row.symbol ? (recentPositiveDaysBySymbol.get(row.symbol) ?? 0) : 0,
      recentNegativeDays: row.symbol ? (recentNegativeDaysBySymbol.get(row.symbol) ?? 0) : 0
    })) ?? [];
  const compareDate = recentDates[0] ?? previousDate;
  const compareHref = compareDate ? `/compare?date=${encodeURIComponent(date)}&compareDate=${encodeURIComponent(compareDate)}` : "/compare";

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
              {parsedStockTable ? (
                <>
                  {parsedStockTable.beforeMarkdown ? (
                    <article className="markdown-body report-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsedStockTable.beforeMarkdown}</ReactMarkdown>
                    </article>
                  ) : null}
                  <ReportStockTable rows={enhancedRows} variant="embedded" title={null} description={null} />
                  {parsedStockTable.afterMarkdown ? (
                    <article className="markdown-body report-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsedStockTable.afterMarkdown}</ReactMarkdown>
                    </article>
                  ) : null}
                </>
              ) : (
                <article className="markdown-body report-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayMarkdown}</ReactMarkdown>
                </article>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="report-right">
          <div className="space-y-6">
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
                    <Link href={compareHref}>
                      <ArrowLeftRight className="h-4 w-4" />
                      日报对比
                    </Link>
                  </Button>
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

            <FavoriteStocksPanel rows={enhancedRows} stockItems={stockItems} />
            {enhancedRows.length > 0 ? <HomeMoversPanel rows={enhancedRows} /> : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
