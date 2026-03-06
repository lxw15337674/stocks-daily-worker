import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Newspaper, Rss, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateJumpForm } from "@/components/date-jump-form";
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
  return { generatedAt };
}

function stripHiddenMetaLines(markdown: string): string {
  return markdown
    .split(/\r?\n/g)
    .filter((line) => {
      const trimmed = line.trim();
      return !/^>\s*样本范围：/.test(trimmed) && !/^>\s*有效行情：/.test(trimmed);
    })
    .join("\n");
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
  const normalized = input
    // Normalize common Unicode sign variants first (e.g. "−10.2%")
    .replace(/[−﹣－–—]/g, "-")
    .replace(/＋/g, "+")
    .replace(/,/g, "")
    .replace(/[^0-9.+-]/g, "");
  if (!normalized || normalized === "+" || normalized === "-") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function findColumnIndex(headers: string[], matcher: RegExp, fallback: number): number {
  for (let index = 0; index < headers.length; index += 1) {
    const normalized = headers[index].replace(/\s+/g, "");
    if (matcher.test(normalized)) {
      return index;
    }
  }
  return fallback;
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

  const headerCells = parseTableCells(tableLines[0]);
  const rankIndex = findColumnIndex(headerCells, /^排名$/, 0);
  const companyIndex = findColumnIndex(headerCells, /^公司名称$/, 1);
  const codeIndex = findColumnIndex(headerCells, /^股票代码/, 2);
  const closeIndex = findColumnIndex(headerCells, /^收盘价$/, 3);
  const changeIndex = findColumnIndex(headerCells, /^涨跌幅/, 4);

  return tableLines
    .slice(2)
    .filter((line) => !/^\|\s*[-:| ]+\|?$/.test(line))
    .map((line) => {
      const cells = parseTableCells(line);
      const rankText = cells[rankIndex] ?? "";
      const company = cells[companyIndex] ?? "-";
      const code = cells[codeIndex] ?? "-";
      const closeText = cells[closeIndex] ?? "-";
      const changeText = cells[changeIndex] ?? "-";

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

function splitMarkdownByStockTable(markdown: string): {
  before: string;
  after: string;
  hasStockSection: boolean;
} {
  const start = markdown.indexOf(STOCK_TABLE_SECTION_TITLE);
  if (start < 0) {
    return { before: markdown, after: "", hasStockSection: false };
  }

  const end = markdown.indexOf(STOCK_NEWS_SECTION_TITLE, start);
  if (end < 0) {
    return { before: markdown, after: "", hasStockSection: false };
  }

  const before = markdown.slice(0, start).trimEnd();
  const after = markdown.slice(end).trimStart();
  return { before, after, hasStockSection: true };
}

export default async function HomePage(props: HomePageProps) {
  const { date: queryDateRaw } = await props.searchParams;
  const queryDate = queryDateRaw?.trim() ?? "";
  const hasExplicitDate = isValidReportDate(queryDate);
  const date = hasExplicitDate ? queryDate : getTodayEtDateString();

  const [reportResult, history] = await Promise.all([fetchReportByDate(date), fetchReportList(120)]);
  const markdown = reportResult.markdown;
  const latestAvailableDate = history.find((item) => isValidReportDate(item.reportDateEt))?.reportDateEt ?? null;

  if (!markdown && !hasExplicitDate && latestAvailableDate && latestAvailableDate !== date) {
    redirect(`/?date=${latestAvailableDate}`);
  }

  const previousDate = addDaysToReportDate(date, -1);
  const nextDate = addDaysToReportDate(date, 1);
  const recentDates = pickRecentDates(history, date);
  const reportMeta = markdown ? extractReportMeta(markdown) : {};
  const cleanedMarkdown = markdown ? stripHiddenMetaLines(markdown) : "";
  const stockRows = cleanedMarkdown ? extractStockTableRows(cleanedMarkdown) : [];
  const markdownSections = cleanedMarkdown
    ? splitMarkdownByStockTable(cleanedMarkdown)
    : { before: "", after: "", hasStockSection: false };
  const isMissingReport = !markdown && (reportResult.status === 400 || reportResult.status === 404);
  const emptyHint = isMissingReport
    ? latestAvailableDate
      ? `当前日期 ${date} 暂无日报，可先查看最近可用日期 ${latestAvailableDate}。`
      : `当前日期 ${date} 暂无日报，请先生成报告后再查看。`
    : reportResult.status > 0
      ? `读取报告失败（HTTP ${reportResult.status}），请稍后重试。`
      : "读取报告时发生网络异常，请稍后重试。";
  const primaryAction = latestAvailableDate && latestAvailableDate !== date
    ? { href: `/?date=${latestAvailableDate}`, label: `查看最近可用日报（${latestAvailableDate}）` }
    : !isMissingReport
      ? { href: `/?date=${date}`, label: "重试当前日期" }
      : { href: "/", label: "回到今天" };

  return (
    <main className="page-shell">
      <div className="report-layout">
        <aside className="report-left">
          <div className="report-sticky space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">日期导航</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DateJumpForm
                  initialDate={date}
                  label="跳转到指定交易日"
                  submitLabel="跳转日期"
                  buttonVariant="secondary"
                  buttonSize="sm"
                />

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

            <Card>
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
          </div>
        </aside>

        <section className="report-main">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-2xl">{date}</CardTitle>
                  <p className="meta mt-1">美东交易日：{toReadableDate(date)}</p>
                </div>
                <Badge variant={markdown ? "outline" : "secondary"}>{markdown ? "完整日报" : "空数据提示"}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {markdown ? (
                <>
                  {markdownSections.before ? (
                    <article className="markdown-body report-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownSections.before}</ReactMarkdown>
                    </article>
                  ) : null}
                  {stockRows.length > 0 && markdownSections.hasStockSection ? <ReportStockTable rows={stockRows} /> : null}
                  {markdownSections.after ? (
                    <article className="markdown-body report-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownSections.after}</ReactMarkdown>
                    </article>
                  ) : null}
                </>
              ) : (
                <div className="py-6 text-center">
                  <p className="meta">{emptyHint}</p>
                  <div className="mt-4 flex justify-center">
                    <Button asChild className="min-w-[320px] max-w-full">
                      <Link href={primaryAction.href}>{primaryAction.label}</Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </main>
  );
}
