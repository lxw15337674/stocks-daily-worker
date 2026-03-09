import Link from "next/link";
import { ArrowLeftRight, CalendarDays, ChevronLeft, LineChart, Newspaper, TrendingDown, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FavoriteStockButton } from "@/components/favorite-stock-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchStockDetail, fetchStockList, type StockDetailResult, type StockHistoryPoint } from "@/lib/api";
import { toReadableDate } from "@/lib/date";

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

export default async function StockDetailPage(props: StockDetailPageProps) {
  const { symbol: rawSymbol } = await props.params;
  const { compare: rawCompare } = await props.searchParams;
  const symbol = rawSymbol.trim();
  const compareSymbol = rawCompare?.trim() || "";

  const [detail, stockItems] = await Promise.all([fetchStockDetail(symbol), fetchStockList()]);
  if (!detail) {
    notFound();
  }

  const compareTarget =
    compareSymbol && compareSymbol.toUpperCase() !== detail.stock.symbol.toUpperCase()
      ? await fetchStockDetail(compareSymbol)
      : null;

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
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                    <FavoriteStockButton symbol={detail.stock.symbol} showLabel variant="outline" />
                  </div>
                  <p className="meta">代码映射：{detail.stock.codes}</p>
                  <p className="meta">
                    最近日报：{detail.latestReportDateEt ? `${detail.latestReportDateEt} (${toReadableDate(detail.latestReportDateEt)})` : "暂无"}
                  </p>
                </div>
              </div>

              <form method="get" className="w-full max-w-md space-y-2 rounded-xl border bg-background/40 p-4">
                <label htmlFor="compare-symbol" className="text-sm font-medium">
                  历史趋势对比
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
              <p className={`mt-2 text-sm font-medium ${detail.latestQuote ? changeTextClass(detail.latestQuote.changePct) : "text-muted-foreground"}`}>
                {detail.latestQuote ? formatSignedPct(detail.latestQuote.changePct) : "无涨跌幅数据"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">成交量</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{detail.latestQuote ? formatCompactNumber(detail.latestQuote.volume) : "暂无"}</p>
              <p className="meta mt-2">估算成交额 {detail.latestQuote ? formatCompactNumber(detail.latestQuote.turnoverEstimate) : "--"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">观察窗口</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{detail.history.length} 天</p>
              <p className={`mt-2 text-sm font-medium ${primaryWindow ? changeTextClass(primaryWindow.returnPct) : "text-muted-foreground"}`}>
                {primaryWindow ? `区间收益 ${formatSignedPct(primaryWindow.returnPct)}` : "样本不足"}
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LineChart className="h-4 w-4" />
                AI 个股总览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-foreground/90">{detail.latestAiSummary ?? "当前还没有可展示的 AI 个股摘要。"}</p>
            </CardContent>
          </Card>

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
        </div>

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
                  <p className={`mt-2 text-2xl font-semibold ${comparisonWindow ? changeTextClass(comparisonWindow.returnPct) : "text-muted-foreground"}`}>
                    {comparisonWindow ? formatSignedPct(comparisonWindow.returnPct) : "暂无"}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">{compareTarget.stock.symbol} 区间收益</p>
                  <p className={`mt-2 text-2xl font-semibold ${secondaryWindow ? changeTextClass(secondaryWindow.returnPct) : "text-muted-foreground"}`}>
                    {secondaryWindow ? formatSignedPct(secondaryWindow.returnPct) : "暂无"}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/40 p-4">
                  <p className="text-sm text-muted-foreground">相对超额</p>
                  <p className={`mt-2 text-2xl font-semibold ${relativeSpread !== null ? changeTextClass(relativeSpread) : "text-muted-foreground"}`}>
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
                            <div className={`text-xs ${changeTextClass(item.primary.changePct)}`}>{formatSignedPct(item.primary.changePct)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="whitespace-nowrap">{formatPrice(item.secondary.close, item.secondary.currency)}</div>
                            <div className={`text-xs ${changeTextClass(item.secondary.changePct)}`}>{formatSignedPct(item.secondary.changePct)}</div>
                          </TableCell>
                          <TableCell className={changeTextClass(item.spreadPct)}>{formatSignedPct(item.spreadPct)}</TableCell>
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
                        <TableCell className="text-right whitespace-nowrap">{formatPrice(item.close, item.currency)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatPrice(item.previousClose, item.currency)}</TableCell>
                        <TableCell className={`text-right whitespace-nowrap font-medium ${changeTextClass(item.changePct)}`}>
                          {item.changePct > 0 ? <TrendingUp className="mr-1 inline h-3.5 w-3.5" /> : item.changePct < 0 ? <TrendingDown className="mr-1 inline h-3.5 w-3.5" /> : null}
                          {formatSignedPct(item.changePct)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCompactNumber(item.volume)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCompactNumber(item.turnoverEstimate)}</TableCell>
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
