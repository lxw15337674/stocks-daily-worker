import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Newspaper, Rss, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportStockTable, type ReportStockRow } from "@/components/report-stock-table";
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

const STOCK_TABLE_SECTION_TITLE = "## 二、股票数据";
const STOCK_NEWS_SECTION_TITLE = "## 三、相关新闻（按公司）";

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

function parseTableCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeading = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = withoutLeading.endsWith("|") ? withoutLeading.slice(0, -1) : withoutLeading;
  return withoutTrailing.split("|").map((cell) => cell.trim());
}

function parseNumericValue(input: string): number | null {
  const normalized = input.replace(/,/g, "").replace(/[^0-9.+-]/g, "");
  if (!normalized || normalized === "+" || normalized === "-") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractXueqiuUrlFromCode(codeCell: string): string | null {
  const tokens = codeCell
    .split("/")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  for (const token of tokens) {
    const hkMatch = token.match(/^HK\s*:\s*(\d{1,5})$/i);
    if (hkMatch) {
      const padded = hkMatch[1].padStart(5, "0");
      return `https://xueqiu.com/S/${padded}`;
    }
  }

  for (const token of tokens) {
    const usMatch = token.match(/^[A-Za-z][A-Za-z0-9._-]{0,9}$/);
    if (usMatch) {
      return `https://xueqiu.com/S/${token.toUpperCase()}`;
    }
  }

  for (const token of tokens) {
    const hkSuffixMatch = token.match(/^(\d{1,5})\.HK$/i);
    if (hkSuffixMatch) {
      const padded = hkSuffixMatch[1].padStart(5, "0");
      return `https://xueqiu.com/S/${padded}`;
    }
  }

  return null;
}

function extractStockTableRows(markdown: string): ReportStockRow[] {
  const start = markdown.indexOf(STOCK_TABLE_SECTION_TITLE);
  if (start < 0) {
    return [];
  }

  const end = markdown.indexOf(STOCK_NEWS_SECTION_TITLE, start);
  if (end < 0) {
    return [];
  }

  const section = markdown.slice(start, end);
  const tableLines = section
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (tableLines.length <= 2) {
    return [];
  }

  return tableLines
    .slice(2)
    .filter((line) => !/^\|\s*[-:| ]+\|?$/.test(line))
    .map((line) => {
      const cells = parseTableCells(line);
      const rankText = cells[0] ?? "";
      const company = cells[1] ?? "-";
      const code = cells[2] ?? "-";
      const closeText = cells[3] ?? "-";
      const changeText = cells[4] ?? "-";

      return {
        rank: parseNumericValue(rankText),
        company,
        code,
        xueqiuUrl: extractXueqiuUrlFromCode(code),
        closeText,
        closeValue: parseNumericValue(closeText),
        changeText,
        changeValue: parseNumericValue(changeText)
      };
    });
}

function stripStockTableSection(markdown: string): string {
  const start = markdown.indexOf(STOCK_TABLE_SECTION_TITLE);
  if (start < 0) {
    return markdown;
  }

  const end = markdown.indexOf(STOCK_NEWS_SECTION_TITLE, start);
  if (end < 0) {
    return markdown;
  }

  const before = markdown.slice(0, start).trimEnd();
  const after = markdown.slice(end).trimStart();
  return `${before}\n\n${after}`.replace(/\n{3,}/g, "\n\n");
}

export default async function HomePage(props: HomePageProps) {
  const { date: queryDateRaw } = await props.searchParams;
  const queryDate = queryDateRaw?.trim() ?? "";
  const date = isValidReportDate(queryDate) ? queryDate : getTodayEtDateString();

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
  const stockRows = extractStockTableRows(markdown);
  const markdownWithoutStockTable = stockRows.length > 0 ? stripStockTableSection(markdown) : markdown;

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
                <Label htmlFor="detail-report-date" className="text-muted-foreground">
                  跳转到指定交易日
                </Label>
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
              {stockRows.length > 0 ? <ReportStockTable rows={stockRows} /> : null}
              <article className="markdown-body report-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownWithoutStockTable}</ReactMarkdown>
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
                <Button asChild variant="outline" size="sm" className="justify-start gap-1.5">
                  <a href="/rss.xml">
                    <Rss className="h-3.5 w-3.5" />
                    RSS 2.0
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <a href="/atom.xml">Atom 1.0</a>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <a href="/feed.json">JSON Feed</a>
                </Button>
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
