import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  LineChart,
  Newspaper,
  ScanSearch,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchReportByDate,
  fetchStockDetail,
  fetchStockDetails,
  fetchStockList,
  type StockDetailResult,
  type StockHistoryPoint
} from "@/lib/api";
import { toReadableDate } from "@/lib/date";
import {
  parseCompanyNewsSections,
  parseReportStockTable,
  type ParsedReportStockRow
} from "@/lib/report-parser";

type StockDetailPageProps = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ compare?: string }>;
};

type ComparisonRow = {
  reportDateEt: string;
  primary: StockHistoryPoint;
  secondary: StockHistoryPoint;
  spreadPct: number;
};

type RankedPoolRow = ParsedReportStockRow & {
  newsCount: number;
  streak: {
    direction: "up" | "down" | "flat";
    count: number;
  };
  recentFiveDayReturn: number | null;
};

type RelativeMetric = {
  label: string;
  rank: number | null;
  total: number;
  value: string;
  hint: string;
  tone: "positive" | "negative" | "neutral";
};

function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatSignedPct(value: number): string {
  const rounded = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function changeTextClass(value: number): string {
  if (value > 0) {
    return "text-red-400";
  }
  if (value < 0) {
    return "text-emerald-400";
  }
  return "text-muted-foreground";
}

function buildComparisonRows(primary: StockHistoryPoint[], secondary: StockHistoryPoint[]): ComparisonRow[] {
  const secondaryByDate = new Map(secondary.map((item) => [item.reportDateEt, item]));
  return primary
    .filter((item) => secondaryByDate.has(item.reportDateEt))
    .map((item) => {
      const matched = secondaryByDate.get(item.reportDateEt)!;
      return {
        reportDateEt: item.reportDateEt,
        primary: item,
        secondary: matched,
        spreadPct: item.changePct - matched.changePct
      };
    });
}

function summarizeWindow(points: StockHistoryPoint[]): { days: number; returnPct: number } | null {
  if (points.length < 2) {
    return null;
  }

  const ordered = [...points].sort((a, b) => a.reportDateEt.localeCompare(b.reportDateEt));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (first.close === 0) {
    return null;
  }

  return {
    days: ordered.length,
    returnPct: ((last.close - first.close) / first.close) * 100
  };
}

function calculateLatestStreak(changeValues: Array<number | null | undefined>): {
  direction: "up" | "down" | "flat";
  count: number;
} {
  const firstValid = changeValues.find((value) => value !== null && value !== undefined) ?? null;
  if (firstValid === null) {
    return { direction: "flat", count: 0 };
  }
  if (firstValid === 0) {
    return { direction: "flat", count: 1 };
  }

  const direction = firstValid > 0 ? "up" : "down";
  let count = 0;
  for (const value of changeValues) {
    if (value === null || value === undefined) {
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

function calculateRecentReturn(closeValues: Array<number | null | undefined>, windowSize: number): number | null {
  const ordered = closeValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
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

function buildRelativeMetric(options: {
  label: string;
  rows: RankedPoolRow[];
  targetSymbol: string;
  valueText: string;
  hint: string;
  getValue: (row: RankedPoolRow) => number | null;
  tone: "positive" | "negative" | "neutral";
}): RelativeMetric {
  const scored = options.rows
    .map((row) => ({
      symbol: row.symbol,
      value: row.symbol ? options.getValue(row) : null
    }))
    .filter(
      (item): item is { symbol: string | null; value: number } =>
        typeof item.value === "number" && Number.isFinite(item.value)
    )
    .sort((a, b) => b.value - a.value || String(a.symbol).localeCompare(String(b.symbol)));

  const index = scored.findIndex((item) => item.symbol === options.targetSymbol);

  return {
    label: options.label,
    rank: index >= 0 ? index + 1 : null,
    total: scored.length,
    value: options.valueText,
    hint: options.hint,
    tone: options.tone
  };
}

function describeStreak(streak: RankedPoolRow["streak"]): string {
  if (streak.direction === "up" && streak.count > 0) {
    return `连涨 ${streak.count} 天`;
  }
  if (streak.direction === "down" && streak.count > 0) {
    return `连跌 ${streak.count} 天`;
  }
  if (streak.direction === "flat" && streak.count > 0) {
    return "平收";
  }
  return "暂无连续信号";
}

function buildPoolRows(
  detailBySymbol: Map<string, StockDetailResult>,
  tableRows: ParsedReportStockRow[],
  newsCountBySymbol: Map<string, number>
): RankedPoolRow[] {
  return tableRows
    .map((row) => {
      if (!row.symbol) {
        return null;
      }

      const stockDetail = detailBySymbol.get(row.symbol);
      return {
        ...row,
        newsCount: newsCountBySymbol.get(row.symbol) ?? 0,
        streak: calculateLatestStreak(stockDetail?.history.map((item) => item.changePct) ?? []),
        recentFiveDayReturn: calculateRecentReturn(stockDetail?.history.map((item) => item.close) ?? [], 5)
      };
    })
    .filter((row): row is RankedPoolRow => row !== null);
}

export default async function StockDetailPage(props: StockDetailPageProps) {
  const { symbol: rawSymbol } = await props.params;
  const { compare: rawCompare } = await props.searchParams;
  const symbol = rawSymbol.trim();
  const compareSymbol = rawCompare?.trim() || "";
  const normalizedCompareSymbol =
    compareSymbol && compareSymbol.toUpperCase() !== symbol.toUpperCase() ? compareSymbol : "";

  const [detail, stockItems, compareTarget] = await Promise.all([
    fetchStockDetail(symbol),
    fetchStockList(),
    normalizedCompareSymbol ? fetchStockDetail(normalizedCompareSymbol) : Promise.resolve(null)
  ]);
  if (!detail) {
    notFound();
  }

  let poolRows: RankedPoolRow[] = [];
  if (detail.latestReportDateEt) {
    const latestReport = await fetchReportByDate(detail.latestReportDateEt);
    if (latestReport.markdown) {
      const parsedTable = parseReportStockTable(latestReport.markdown, stockItems);
      const newsSections = parseCompanyNewsSections(latestReport.markdown);
      const newsCountBySymbol = new Map(newsSections.map((item) => [item.symbol, item.newsCount]));
      const tableSymbols = Array.from(
        new Set(
          (parsedTable?.rows ?? [])
            .map((row) => row.symbol)
            .filter((item): item is string => typeof item === "string" && item.length > 0)
        )
      );
      const poolDetails = await fetchStockDetails(tableSymbols);
      const detailBySymbol = new Map(poolDetails.map((item) => [item.stock.symbol, item]));
      poolRows = buildPoolRows(detailBySymbol, parsedTable?.rows ?? [], newsCountBySymbol);
    }
  }

  const currentPoolRow = poolRows.find((row) => row.symbol === detail.stock.symbol) ?? null;
  const relativeMetrics = currentPoolRow
    ? [
        buildRelativeMetric({
          label: "当日涨跌幅",
          rows: poolRows,
          targetSymbol: detail.stock.symbol,
          valueText: currentPoolRow.changeText || "-",
          hint: "按当日日表现排序",
          getValue: (row) => row.changeValue ?? null,
          tone: (currentPoolRow.changeValue ?? 0) > 0 ? "positive" : (currentPoolRow.changeValue ?? 0) < 0 ? "negative" : "neutral"
        }),
        buildRelativeMetric({
          label: "新闻热度",
          rows: poolRows,
          targetSymbol: detail.stock.symbol,
          valueText: `${currentPoolRow.newsCount} 条`,
          hint: "按日报中的公司新闻条数排序",
          getValue: (row) => row.newsCount,
          tone: currentPoolRow.newsCount > 0 ? "positive" : "neutral"
        }),
        buildRelativeMetric({
          label: "5日强弱",
          rows: poolRows,
          targetSymbol: detail.stock.symbol,
          valueText:
            currentPoolRow.recentFiveDayReturn === null ? "-" : formatSignedPct(currentPoolRow.recentFiveDayReturn),
          hint: "按近 5 个交易日累计收益排序",
          getValue: (row) => row.recentFiveDayReturn,
          tone:
            (currentPoolRow.recentFiveDayReturn ?? 0) > 0
              ? "positive"
              : (currentPoolRow.recentFiveDayReturn ?? 0) < 0
                ? "negative"
                : "neutral"
        })
      ]
    : [];

  const comparisonRows = compareTarget ? buildComparisonRows(detail.history, compareTarget.history) : [];
  const primaryWindow = summarizeWindow(detail.history);
  const comparisonWindow = compareTarget ? summarizeWindow(comparisonRows.map((item) => item.primary)) : null;
  const secondaryWindow = compareTarget ? summarizeWindow(comparisonRows.map((item) => item.secondary)) : null;
  const relativeSpread =
    comparisonWindow && secondaryWindow ? comparisonWindow.returnPct - secondaryWindow.returnPct : null;

  return (
    <main className="page-shell">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <Button asChild variant="ghost" size="sm" className="px-0">
                  <Link href="/">
                    <ChevronLeft className="h-4 w-4" />
                    返回日报首页
                  </Link>
                </Button>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-3xl">{detail.stock.displayName}</CardTitle>
                    <Badge variant="outline">{detail.stock.symbol}</Badge>
                    <Badge variant="secondary">{detail.stock.businessType}</Badge>
                  </div>
                  <p className="meta">代码映射：{detail.stock.codes}</p>
                  <p className="meta">
                    最近日报：
                    {detail.latestReportDateEt
                      ? `${detail.latestReportDateEt} (${toReadableDate(detail.latestReportDateEt)})`
                      : "暂无"}
                  </p>
                </div>
              </div>

              <form method="get" className="w-full max-w-md space-y-2 rounded-xl border bg-background/40 p-4">
                <label htmlFor="compare-symbol" className="text-sm font-medium">
                  个股对比
                </label>
                <select
                  id="compare-symbol"
                  name="compare"
                  defaultValue={compareTarget?.stock.symbol ?? ""}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring"
                >
                  <option value="">选择对比标的</option>
                  {stockItems
                    .filter((item) => item.symbol !== detail.stock.symbol)
                    .map((item) => (
                      <option key={item.symbol} value={item.symbol}>
                        {item.displayName}
                      </option>
                    ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" variant="secondary" className="gap-1.5">
                    <ArrowLeftRight className="h-4 w-4" />
                    更新对比
                  </Button>
                  {compareTarget ? (
                    <Button asChild type="button" size="sm" variant="outline">
                      <Link href={`/stock/${encodeURIComponent(detail.stock.symbol)}`}>清除对比</Link>
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>
          </CardHeader>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">最新收盘价</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {detail.latestQuote ? formatPrice(detail.latestQuote.close, detail.latestQuote.currency) : "暂无"}
              </p>
              <p
                className={`mt-2 text-sm font-medium ${detail.latestQuote ? changeTextClass(detail.latestQuote.changePct) : "text-muted-foreground"}`}
              >
                {detail.latestQuote ? formatSignedPct(detail.latestQuote.changePct) : "无涨跌幅数据"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">固定池定位</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {currentPoolRow && relativeMetrics[0]?.rank
                  ? `第 ${relativeMetrics[0].rank}/${relativeMetrics[0].total}`
                  : "暂无"}
              </p>
              <p className="meta mt-2">
                {currentPoolRow ? `当日 ${currentPoolRow.changeText || "-"}，${describeStreak(currentPoolRow.streak)}` : "最近日报未匹配到该股票"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">最近日报记录</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{detail.reportRecords.length} 次</p>
              <p className="meta mt-2">
                {detail.reportRecords[0]
                  ? `最近一次 ${detail.reportRecords[0].newsCount} 条新闻`
                  : "当前还没有日报留痕"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">新闻覆盖</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{detail.recentNews.length} 条</p>
              <p className="meta mt-2">别名 {detail.stock.aliases.slice(0, 4).join(" / ") || "暂无"}</p>
            </CardContent>
          </Card>
        </section>

        {currentPoolRow ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ScanSearch className="h-4 w-4" />
                  固定池相对位置
                </CardTitle>
                <Badge variant="outline">{poolRows.length} 只样本</Badge>
              </div>
              <p className="meta">
                {detail.stock.symbol} 在最近一期日报里属于 {currentPoolRow.company}，{describeStreak(currentPoolRow.streak)}。
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {relativeMetrics.map((item) => (
                  <div key={item.label} className="rounded-xl border bg-background/40 p-4">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p
                      className={`mt-2 text-2xl font-semibold ${
                        item.tone === "positive"
                          ? "text-red-400"
                          : item.tone === "negative"
                            ? "text-emerald-400"
                            : "text-foreground"
                      }`}
                    >
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm text-foreground/90">
                      {item.rank ? `固定池第 ${item.rank}/${item.total}` : "暂无可比较样本"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-background/40 p-4 text-sm leading-6 text-foreground/90">
                当日收盘 {currentPoolRow.closeText}，涨跌幅 {currentPoolRow.changeText || "-"}，新闻 {currentPoolRow.newsCount} 条，
                近 5 日 {currentPoolRow.recentFiveDayReturn === null ? "暂无累计收益数据" : `累计 ${formatSignedPct(currentPoolRow.recentFiveDayReturn)}`}。
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LineChart className="h-4 w-4" />
                AI 个股总览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-foreground/90">
                {detail.latestAiSummary ?? "当前还没有可展示的 AI 个股摘要。"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-4 w-4" />
                  最近几次日报记录
                </CardTitle>
                <Badge variant="outline">{detail.reportRecords.length} 次</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.reportRecords.length === 0 ? (
                <p className="empty">暂无日报记录。</p>
              ) : (
                detail.reportRecords.map((item) => (
                  <article key={`${item.reportDateEt}-${item.close}`} className="rounded-xl border bg-background/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link href={`/?date=${item.reportDateEt}`} className="font-medium hover:text-primary">
                          {item.reportDateEt}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">{toReadableDate(item.reportDateEt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {detail.latestQuote ? formatPrice(item.close, detail.latestQuote.currency) : item.close.toFixed(2)}
                        </p>
                        <p className={`mt-1 text-xs font-medium ${changeTextClass(item.changePct)}`}>
                          {formatSignedPct(item.changePct)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/70 px-2.5 py-1">新闻 {item.newsCount} 条</span>
                      <span className="rounded-full border border-border/70 px-2.5 py-1">日报复盘节点</span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-foreground/90">
                      {item.aiSummary ?? "该次日报暂无 AI 个股摘要，建议结合当天正文和新闻列表继续查看。"}
                    </p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Newspaper className="h-4 w-4" />
              最近新闻
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.recentNews.length === 0 ? (
              <p className="empty">暂无可展示的相关新闻。</p>
            ) : (
              detail.recentNews.map((item) => (
                <article key={`${item.link}-${item.publishedAt}`} className="rounded-xl border bg-background/40 p-3">
                  <a href={item.link} target="_blank" rel="noreferrer" className="font-medium leading-6 hover:text-primary">
                    {item.title}
                  </a>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{formatPublishedAt(item.publishedAt)}</span>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        {compareTarget ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  对比摘要: {detail.stock.symbol} vs {compareTarget.stock.symbol}
                </CardTitle>
                <Badge variant="outline">{comparisonRows.length} 个重叠交易日</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">{detail.stock.symbol} 区间收益</p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${comparisonWindow ? changeTextClass(comparisonWindow.returnPct) : "text-muted-foreground"}`}
                  >
                    {comparisonWindow ? formatSignedPct(comparisonWindow.returnPct) : "暂无"}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">{compareTarget.stock.symbol} 区间收益</p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${secondaryWindow ? changeTextClass(secondaryWindow.returnPct) : "text-muted-foreground"}`}
                  >
                    {secondaryWindow ? formatSignedPct(secondaryWindow.returnPct) : "暂无"}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">相对超额</p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${relativeSpread !== null ? changeTextClass(relativeSpread) : "text-muted-foreground"}`}
                  >
                    {relativeSpread !== null ? formatSignedPct(relativeSpread) : "暂无"}
                  </p>
                </div>
              </div>

              {comparisonRows.length === 0 ? (
                <p className="empty">两只股票暂无可重叠的历史数据。</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>{detail.stock.symbol}</TableHead>
                        <TableHead>{compareTarget.stock.symbol}</TableHead>
                        <TableHead>单日差值</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonRows.slice(0, 12).map((item) => (
                        <TableRow key={`compare-${item.reportDateEt}`}>
                          <TableCell>{item.reportDateEt}</TableCell>
                          <TableCell>
                            <div className="whitespace-nowrap">{formatPrice(item.primary.close, item.primary.currency)}</div>
                            <div className={`text-xs ${changeTextClass(item.primary.changePct)}`}>
                              {formatSignedPct(item.primary.changePct)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="whitespace-nowrap">{formatPrice(item.secondary.close, item.secondary.currency)}</div>
                            <div className={`text-xs ${changeTextClass(item.secondary.changePct)}`}>
                              {formatSignedPct(item.secondary.changePct)}
                            </div>
                          </TableCell>
                          <TableCell className={changeTextClass(item.spreadPct)}>
                            {formatSignedPct(item.spreadPct)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-4 w-4" />
                历史行情
              </CardTitle>
              <p className="meta">最近 {detail.history.length} 个交易日</p>
            </div>
          </CardHeader>
          <CardContent>
            {detail.history.length === 0 ? (
              <p className="empty">暂无历史行情数据。</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead className="text-right">收盘价</TableHead>
                      <TableHead className="text-right">前收</TableHead>
                      <TableHead className="text-right">涨跌幅</TableHead>
                      <TableHead className="text-right">成交量</TableHead>
                      <TableHead className="text-right">估算成交额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.history.map((item) => (
                      <TableRow key={item.reportDateEt}>
                        <TableCell>
                          <div>{item.reportDateEt}</div>
                          <div className="text-xs text-muted-foreground">{toReadableDate(item.reportDateEt)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatPrice(item.close, item.currency)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatPrice(item.previousClose, item.currency)}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap text-right font-medium ${changeTextClass(item.changePct)}`}>
                          {item.changePct > 0 ? (
                            <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                          ) : item.changePct < 0 ? (
                            <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                          ) : null}
                          {formatSignedPct(item.changePct)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCompactNumber(item.volume)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatCompactNumber(item.turnoverEstimate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
