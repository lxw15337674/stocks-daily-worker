import Link from "next/link";
import { ArrowLeftRight, CalendarDays, ChevronLeft, Newspaper, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pickBestCompareTarget } from "@/lib/compare-target";
import { fetchReportByDate, fetchReportList, fetchStockList, type ReportListItem } from "@/lib/api";
import {
  parseAiOverview,
  parseCompanyNewsSections,
  parseReportStockTable,
  stripReportMetaQuoteBlock,
  type ParsedReportStockRow
} from "@/lib/report-parser";
import { isValidReportDate, toReadableDate } from "@/lib/date";

type ComparePageProps = {
  searchParams: Promise<{ date?: string; compareDate?: string }>;
};

type ComparisonRow = {
  key: string;
  company: string;
  symbol: string | null;
  businessType?: string | null;
  detailUrl: string | null;
  changeValue: number | null;
  currentCloseText: string;
  previousCloseText: string;
  currentChangeText: string;
  previousChangeText: string;
  currentChangeValue: number | null;
  previousChangeValue: number | null;
  deltaValue: number | null;
  currentNewsCount: number;
};

type ToneLabel = "偏积极" | "偏谨慎" | "中性";
type WatchlistCategory = "新闻驱动" | "趋势驱动" | "样本变化";
type WatchlistSignalTone = "positive" | "negative" | "neutral";

type WatchlistMetric = {
  label: string;
  value: string;
  tone?: WatchlistSignalTone;
};

type WatchlistObservation = {
  label: string;
  detail: string;
  tone?: WatchlistSignalTone;
};

type WatchlistItem = {
  key: string;
  company: string;
  symbol: string | null;
  detailUrl: string | null;
  detailCompareUrl: string | null;
  compareTargetCompany: string | null;
  label: string;
  category: WatchlistCategory;
  summary: string;
  observations: WatchlistObservation[];
  metrics: WatchlistMetric[];
  emphasisValue: number | null;
};

function changeTextClass(value: number | null): string {
  if (value === null) {
    return "text-muted-foreground";
  }
  if (value > 0) {
    return "text-red-400";
  }
  if (value < 0) {
    return "text-emerald-400";
  }
  return "text-muted-foreground";
}

function classifyTone(input: string | null): ToneLabel {
  if (!input) {
    return "中性";
  }

  const normalized = input.toLowerCase();
  const positiveKeywords = ["增长", "超预期", "改善", "回暖", "提振", "上涨", "走强", "积极", "beat", "upgrade", "rise"];
  const negativeKeywords = ["承压", "疲软", "风险", "下滑", "下跌", "走弱", "谨慎", "降温", "downgrade", "fall", "risk"];
  const positiveScore = positiveKeywords.filter((keyword) => normalized.includes(keyword)).length;
  const negativeScore = negativeKeywords.filter((keyword) => normalized.includes(keyword)).length;

  if (positiveScore > negativeScore) {
    return "偏积极";
  }
  if (negativeScore > positiveScore) {
    return "偏谨慎";
  }
  return "中性";
}

function formatSignedPct(value: number | null): string {
  if (value === null) {
    return "-";
  }

  const rounded = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

function formatAbsolutePct(value: number): string {
  return `${Math.abs(value).toFixed(2)}%`;
}

function metricToneClass(tone: WatchlistSignalTone | undefined): string {
  if (tone === "positive") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (tone === "negative") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  return "border-border bg-background/40 text-muted-foreground";
}

function summarizeAiChanges(input: {
  date: string;
  compareDate: string;
  currentOverview: { stockParagraph: string | null; newsParagraph: string | null };
  previousOverview: { stockParagraph: string | null; newsParagraph: string | null };
  comparisonRows: ComparisonRow[];
  newlyAdded: ParsedReportStockRow[];
  removed: ParsedReportStockRow[];
}): string[] {
  const averageDelta =
    input.comparisonRows.length > 0
      ? input.comparisonRows.reduce((sum, row) => sum + (row.deltaValue ?? 0), 0) / input.comparisonRows.length
      : null;
  const positiveCount = input.comparisonRows.filter((row) => (row.deltaValue ?? 0) > 0).length;
  const negativeCount = input.comparisonRows.filter((row) => (row.deltaValue ?? 0) < 0).length;
  const topImproved = input.comparisonRows.filter((row) => (row.deltaValue ?? 0) > 0).slice(0, 2).map((row) => row.company);
  const topWeakened = input.comparisonRows.filter((row) => (row.deltaValue ?? 0) < 0).slice(0, 2).map((row) => row.company);

  const stockToneCurrent = classifyTone(input.currentOverview.stockParagraph);
  const stockTonePrevious = classifyTone(input.previousOverview.stockParagraph);
  const newsToneCurrent = classifyTone(input.currentOverview.newsParagraph);
  const newsTonePrevious = classifyTone(input.previousOverview.newsParagraph);

  const stockSummary =
    averageDelta === null
      ? `两天之间暂无足够重叠样本，无法判断 ${input.date} 相对 ${input.compareDate} 的整体强弱变化。`
      : averageDelta > 0
        ? `${input.date} 相比 ${input.compareDate}，重叠样本平均涨跌幅提升 ${formatAbsolutePct(averageDelta)}，转强 ${positiveCount} 只，股票面语气由${stockTonePrevious}转向${stockToneCurrent}。`
        : averageDelta < 0
          ? `${input.date} 相比 ${input.compareDate}，重叠样本平均涨跌幅回落 ${formatAbsolutePct(averageDelta)}，转弱 ${negativeCount} 只，股票面语气由${stockTonePrevious}转向${stockToneCurrent}。`
          : `${input.date} 与 ${input.compareDate} 的重叠样本平均涨跌幅基本持平，股票面语气维持在${stockToneCurrent}附近。`;

  const leaderSummary =
    topImproved.length === 0 && topWeakened.length === 0
      ? "本次对比没有形成明显的强弱切换。"
      : `转强代表：${topImproved.length > 0 ? topImproved.join("、") : "暂无"}；转弱代表：${topWeakened.length > 0 ? topWeakened.join("、") : "暂无"}。`;

  const newsSummary = `新闻面由${newsTonePrevious}变为${newsToneCurrent}；${input.date} 独有样本 ${input.newlyAdded.length} 只，${input.compareDate} 独有样本 ${input.removed.length} 只。`;

  return [stockSummary, leaderSummary, newsSummary];
}

function pickDistinctDates(items: ReportListItem[]): string[] {
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const item of items) {
    if (seen.has(item.reportDateEt)) {
      continue;
    }
    seen.add(item.reportDateEt);
    dates.push(item.reportDateEt);
  }
  return dates;
}

function resolveDate(input: string | undefined, availableDates: string[], fallbackIndex: number): string | null {
  const normalized = input?.trim() ?? "";
  if (normalized && isValidReportDate(normalized)) {
    return normalized;
  }
  return availableDates[fallbackIndex] ?? null;
}

function buildComparisonRows(currentRows: ParsedReportStockRow[], previousRows: ParsedReportStockRow[]): ComparisonRow[] {
  const previousByKey = new Map<string, ParsedReportStockRow>();
  for (const row of previousRows) {
    const key = row.symbol ?? row.company;
    previousByKey.set(key, row);
  }

  const rows: ComparisonRow[] = [];

  for (const row of currentRows) {
    const key = row.symbol ?? row.company;
    const previous = previousByKey.get(key);
    if (!previous) {
      continue;
    }

    rows.push({
        key,
        company: row.company,
        symbol: row.symbol,
        businessType: row.businessType,
        detailUrl: row.detailUrl,
        changeValue: row.changeValue,
        currentCloseText: row.closeText,
        previousCloseText: previous.closeText,
        currentChangeText: row.changeText,
        previousChangeText: previous.changeText,
        currentChangeValue: row.changeValue,
        previousChangeValue: previous.changeValue,
        deltaValue:
          row.changeValue !== null && previous.changeValue !== null ? row.changeValue - previous.changeValue : null,
        currentNewsCount: row.newsCount ?? 0
      });
  }

  return rows.sort((a, b) => Math.abs(b.deltaValue ?? 0) - Math.abs(a.deltaValue ?? 0));
}

function findUniqueRows(sourceRows: ParsedReportStockRow[], comparisonRows: ParsedReportStockRow[]): ParsedReportStockRow[] {
  const comparisonKeys = new Set(comparisonRows.map((row) => row.symbol ?? row.company));
  return sourceRows.filter((row) => !comparisonKeys.has(row.symbol ?? row.company)).slice(0, 6);
}

function buildWatchlistItems(
  comparisonRows: ComparisonRow[],
  currentRows: ParsedReportStockRow[],
  previousRows: ParsedReportStockRow[],
  newlyAdded: ParsedReportStockRow[],
  removed: ParsedReportStockRow[]
): WatchlistItem[] {
  const buildCompareUrl = (symbol: string | null, compareSymbol: string | null): string | null => {
    if (!symbol) {
      return null;
    }
    const base = `/stock/${encodeURIComponent(symbol)}`;
    return compareSymbol ? `${base}?compare=${encodeURIComponent(compareSymbol)}` : base;
  };

  const items: WatchlistItem[] = [];
  const usedKeys = new Set<string>();

  const strongestTurn = comparisonRows.find((row) => (row.deltaValue ?? 0) > 0);
  if (strongestTurn) {
    usedKeys.add(strongestTurn.key);
    const compareTarget = pickBestCompareTarget(strongestTurn, comparisonRows, "change");
    items.push({
      key: `strong-${strongestTurn.key}`,
      company: strongestTurn.company,
      symbol: strongestTurn.symbol,
      detailUrl: strongestTurn.detailUrl,
      detailCompareUrl: buildCompareUrl(strongestTurn.symbol, compareTarget?.symbol ?? null),
      compareTargetCompany: compareTarget?.company ?? null,
      label: "明显转强",
      category: "趋势驱动",
      summary: `${strongestTurn.company} 是这次对比里最明显的转强样本，适合优先确认是单日脉冲还是进入新一轮强势区间。`,
      observations: [
        {
          label: "幅度切换",
          detail: `相对对比日提升 ${formatSignedPct(strongestTurn.deltaValue)}。`,
          tone: "positive"
        },
        {
          label: "价格状态",
          detail: `当前涨跌幅 ${strongestTurn.currentChangeText}，对比日为 ${strongestTurn.previousChangeText}。`,
          tone: (strongestTurn.currentChangeValue ?? 0) > 0 ? "positive" : "neutral"
        },
        {
          label: "跟踪动作",
          detail: compareTarget
            ? `详情页已默认带入 ${compareTarget.company} 做强弱对照。`
            : "可先单独打开详情页继续跟踪。",
          tone: "neutral"
        }
      ],
      metrics: [
        { label: "当前日", value: strongestTurn.currentChangeText, tone: (strongestTurn.currentChangeValue ?? 0) > 0 ? "positive" : "neutral" },
        { label: "对比日", value: strongestTurn.previousChangeText, tone: (strongestTurn.previousChangeValue ?? 0) < 0 ? "negative" : "neutral" },
        { label: "新闻", value: `${strongestTurn.currentNewsCount} 条`, tone: strongestTurn.currentNewsCount > 0 ? "positive" : "neutral" }
      ],
      emphasisValue: strongestTurn.deltaValue
    });
  }

  const weakestTurn = comparisonRows.find((row) => !usedKeys.has(row.key) && (row.deltaValue ?? 0) < 0);
  if (weakestTurn) {
    usedKeys.add(weakestTurn.key);
    const compareTarget = pickBestCompareTarget(weakestTurn, comparisonRows, "change");
    items.push({
      key: `weak-${weakestTurn.key}`,
      company: weakestTurn.company,
      symbol: weakestTurn.symbol,
      detailUrl: weakestTurn.detailUrl,
      detailCompareUrl: buildCompareUrl(weakestTurn.symbol, compareTarget?.symbol ?? null),
      compareTargetCompany: compareTarget?.company ?? null,
      label: "明显转弱",
      category: "趋势驱动",
      summary: `${weakestTurn.company} 出现了本轮对比里最明确的回落，需要分辨是正常回撤还是阶段性退潮。`,
      observations: [
        {
          label: "幅度回落",
          detail: `相对对比日走弱 ${formatAbsolutePct(weakestTurn.deltaValue ?? 0)}。`,
          tone: "negative"
        },
        {
          label: "价格状态",
          detail: `当前涨跌幅 ${weakestTurn.currentChangeText}，对比日为 ${weakestTurn.previousChangeText}。`,
          tone: (weakestTurn.currentChangeValue ?? 0) < 0 ? "negative" : "neutral"
        },
        {
          label: "跟踪动作",
          detail: compareTarget
            ? `详情页默认对照 ${compareTarget.company}，便于判断是否只是相对弱于同类。`
            : "建议先看详情页历史走势，再决定是否加入对比。",
          tone: "neutral"
        }
      ],
      metrics: [
        { label: "当前日", value: weakestTurn.currentChangeText, tone: (weakestTurn.currentChangeValue ?? 0) < 0 ? "negative" : "neutral" },
        { label: "对比日", value: weakestTurn.previousChangeText, tone: (weakestTurn.previousChangeValue ?? 0) > 0 ? "positive" : "neutral" },
        { label: "新闻", value: `${weakestTurn.currentNewsCount} 条`, tone: weakestTurn.currentNewsCount > 0 ? "neutral" : "negative" }
      ],
      emphasisValue: weakestTurn.deltaValue
    });
  }

  const hottest = comparisonRows
    .filter((row) => !usedKeys.has(row.key))
    .sort((a, b) => b.currentNewsCount - a.currentNewsCount || Math.abs(b.deltaValue ?? 0) - Math.abs(a.deltaValue ?? 0))[0];
  if (hottest && hottest.currentNewsCount > 0) {
    usedKeys.add(hottest.key);
    const compareTarget = pickBestCompareTarget(hottest, comparisonRows, "change");
    items.push({
      key: `hot-${hottest.key}`,
      company: hottest.company,
      symbol: hottest.symbol,
      detailUrl: hottest.detailUrl,
      detailCompareUrl: buildCompareUrl(hottest.symbol, compareTarget?.symbol ?? null),
      compareTargetCompany: compareTarget?.company ?? null,
      label: "消息最密集",
      category: "新闻驱动",
      summary: `${hottest.company} 的新闻密度在本次样本里最高，适合先看消息驱动，再看价格有没有跟上。`,
      observations: [
        {
          label: "新闻覆盖",
          detail: `当天收录 ${hottest.currentNewsCount} 条相关新闻，是当前样本里的最高值之一。`,
          tone: "positive"
        },
        {
          label: "价格反馈",
          detail: `相对对比日变化 ${formatSignedPct(hottest.deltaValue)}，当前涨跌幅 ${hottest.currentChangeText}。`,
          tone: (hottest.deltaValue ?? 0) > 0 ? "positive" : (hottest.deltaValue ?? 0) < 0 ? "negative" : "neutral"
        },
        {
          label: "跟踪动作",
          detail: compareTarget
            ? `默认带入 ${compareTarget.company}，可以直接对照“有消息”和“无消息”的价格差异。`
            : "建议结合详情页新闻列表看消息发布时间和股价反馈。",
          tone: "neutral"
        }
      ],
      metrics: [
        { label: "新闻", value: `${hottest.currentNewsCount} 条`, tone: "positive" },
        { label: "当前日", value: hottest.currentChangeText, tone: (hottest.currentChangeValue ?? 0) > 0 ? "positive" : (hottest.currentChangeValue ?? 0) < 0 ? "negative" : "neutral" },
        { label: "差值", value: formatSignedPct(hottest.deltaValue), tone: (hottest.deltaValue ?? 0) > 0 ? "positive" : (hottest.deltaValue ?? 0) < 0 ? "negative" : "neutral" }
      ],
      emphasisValue: hottest.deltaValue
    });
  }

  if (items.length < 3 && newlyAdded.length > 0) {
    const candidate = newlyAdded[0];
    const compareTarget = pickBestCompareTarget(candidate, currentRows, "change");
    items.push({
      key: `new-${candidate.symbol ?? candidate.company}`,
      company: candidate.company,
      symbol: candidate.symbol,
      detailUrl: candidate.detailUrl,
      detailCompareUrl: buildCompareUrl(candidate.symbol, compareTarget?.symbol ?? null),
      compareTargetCompany: compareTarget?.company ?? null,
      label: "新进入样本",
      category: "样本变化",
      summary: `${candidate.company} 是本次新进入日报样本的标的，更适合从“为什么突然进入名单”这个角度去跟踪。`,
      observations: [
        {
          label: "样本切换",
          detail: `当前日报出现，但对比日报中未收录该股票。`,
          tone: "positive"
        },
        {
          label: "价格状态",
          detail: `本日涨跌幅 ${candidate.changeText}，收盘价 ${candidate.closeText}。`,
          tone: (candidate.changeValue ?? 0) > 0 ? "positive" : (candidate.changeValue ?? 0) < 0 ? "negative" : "neutral"
        },
        {
          label: "跟踪动作",
          detail: compareTarget
            ? `详情页默认配了 ${compareTarget.company}，方便确认它是独立走强还是板块联动。`
            : "可直接打开详情页查看近期历史走势与新闻。",
          tone: "neutral"
        }
      ],
      metrics: [
        { label: "当前日", value: candidate.changeText, tone: (candidate.changeValue ?? 0) > 0 ? "positive" : (candidate.changeValue ?? 0) < 0 ? "negative" : "neutral" },
        { label: "收盘价", value: candidate.closeText, tone: "neutral" },
        { label: "状态", value: "新入样本", tone: "positive" }
      ],
      emphasisValue: candidate.changeValue ?? null
    });
  }

  if (items.length < 3 && removed.length > 0) {
    const candidate = removed[0];
    const compareTarget = pickBestCompareTarget(candidate, previousRows, "change");
    items.push({
      key: `removed-${candidate.symbol ?? candidate.company}`,
      company: candidate.company,
      symbol: candidate.symbol,
      detailUrl: candidate.detailUrl,
      detailCompareUrl: buildCompareUrl(candidate.symbol, compareTarget?.symbol ?? null),
      compareTargetCompany: compareTarget?.company ?? null,
      label: "对比日独有",
      category: "样本变化",
      summary: `${candidate.company} 只出现在对比日报里，当前已经掉出样本，适合排查热度是否已经退潮。`,
      observations: [
        {
          label: "样本切换",
          detail: `对比日报收录，但当前日报没有出现。`,
          tone: "negative"
        },
        {
          label: "对比日状态",
          detail: `它在对比日报中的涨跌幅为 ${candidate.changeText}，收盘价 ${candidate.closeText}。`,
          tone: (candidate.changeValue ?? 0) < 0 ? "negative" : (candidate.changeValue ?? 0) > 0 ? "positive" : "neutral"
        },
        {
          label: "跟踪动作",
          detail: compareTarget
            ? `详情页默认可与 ${compareTarget.company} 对照，判断是个股退潮还是名单整体切换。`
            : "建议结合历史行情和新闻看是否只是单日失焦。",
          tone: "neutral"
        }
      ],
      metrics: [
        { label: "对比日", value: candidate.changeText, tone: (candidate.changeValue ?? 0) < 0 ? "negative" : (candidate.changeValue ?? 0) > 0 ? "positive" : "neutral" },
        { label: "收盘价", value: candidate.closeText, tone: "neutral" },
        { label: "状态", value: "已掉出样本", tone: "negative" }
      ],
      emphasisValue: candidate.changeValue ?? null
    });
  }

  return items.slice(0, 3);
}

function renderCompanyCell(row: { company: string; detailUrl: string | null; symbol: string | null }) {
  if (row.detailUrl) {
    return (
      <Link href={row.detailUrl} className="font-medium hover:text-primary">
        {row.company}
      </Link>
    );
  }

  return <span className="font-medium">{row.company}</span>;
}

export default async function ComparePage(props: ComparePageProps) {
  const { date: dateRaw, compareDate: compareDateRaw } = await props.searchParams;
  const [history, stockItems] = await Promise.all([fetchReportList(120), fetchStockList()]);
  const stockItemBySymbol = new Map(stockItems.map((item) => [item.symbol, item]));
  const availableDates = pickDistinctDates(history);

  const date = resolveDate(dateRaw, availableDates, 0);
  const compareDate = resolveDate(compareDateRaw, availableDates, 1);

  if (!date || !compareDate) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>暂无足够历史日报可供对比</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const [currentReport, previousReport] = await Promise.all([fetchReportByDate(date), fetchReportByDate(compareDate)]);
  if (!currentReport.markdown || !previousReport.markdown) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>未找到可对比的日报</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="meta">请确认两天都已生成日报后再进行对比。</p>
            <Button asChild variant="outline">
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentMarkdown = stripReportMetaQuoteBlock(currentReport.markdown);
  const previousMarkdown = stripReportMetaQuoteBlock(previousReport.markdown);
  const currentOverview = parseAiOverview(currentMarkdown);
  const previousOverview = parseAiOverview(previousMarkdown);
  const currentNewsBySymbol = new Map(parseCompanyNewsSections(currentMarkdown).map((item) => [item.symbol, item.newsCount]));
  const currentTable = parseReportStockTable(currentMarkdown, stockItems);
  const previousTable = parseReportStockTable(previousMarkdown, stockItems);
  const currentRows =
    currentTable?.rows.map((row) => ({
      ...row,
      businessType: row.symbol ? (stockItemBySymbol.get(row.symbol)?.businessType ?? null) : null,
      newsCount: row.symbol ? (currentNewsBySymbol.get(row.symbol) ?? 0) : 0
    })) ?? [];
  const previousRows =
    previousTable?.rows.map((row) => ({
      ...row,
      businessType: row.symbol ? (stockItemBySymbol.get(row.symbol)?.businessType ?? null) : null
    })) ?? [];
  const comparisonRows = buildComparisonRows(currentRows, previousRows);
  const newlyAdded = findUniqueRows(currentRows, previousRows);
  const removed = findUniqueRows(previousRows, currentRows);
  const improvedCount = comparisonRows.filter((row) => (row.deltaValue ?? 0) > 0).length;
  const aiChangeSummary = summarizeAiChanges({
    date,
    compareDate,
    currentOverview,
    previousOverview,
    comparisonRows,
    newlyAdded,
    removed
  });
  const watchlistItems = buildWatchlistItems(comparisonRows, currentRows, previousRows, newlyAdded, removed);

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
                  <CardTitle className="text-3xl">日报对比</CardTitle>
                  <p className="meta">
                    当前对比 {date} 与 {compareDate}
                  </p>
                </div>
              </div>

              <form method="get" className="grid w-full max-w-xl gap-3 rounded-xl border bg-background/40 p-4 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <label htmlFor="compare-date-current" className="text-sm font-medium">
                    当前日报
                  </label>
                  <Input id="compare-date-current" name="date" type="date" defaultValue={date} required />
                </div>
                <div className="space-y-1">
                  <label htmlFor="compare-date-previous" className="text-sm font-medium">
                    对比日报
                  </label>
                  <Input id="compare-date-previous" name="compareDate" type="date" defaultValue={compareDate} required />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full gap-1.5">
                    <ArrowLeftRight className="h-4 w-4" />
                    更新对比
                  </Button>
                </div>
              </form>
            </div>
          </CardHeader>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">重叠样本</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{comparisonRows.length} 只</p>
              <p className="meta mt-2">两天都存在可比行情</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">转强个股</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{improvedCount} 只</p>
              <p className="meta mt-2">当日涨跌幅优于对比日</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">新增样本</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{newlyAdded.length} 只</p>
              <p className="meta mt-2">{date} 独有样本</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">缺失样本</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{removed.length} 只</p>
              <p className="meta mt-2">{compareDate} 独有样本</p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">AI 总览变化摘要</CardTitle>
              <Badge variant="secondary">对比结论</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiChangeSummary.map((item, index) => (
              <div key={`ai-summary-${index}`} className="rounded-xl border bg-background/40 p-4">
                <p className="leading-7 text-foreground/90">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">最值得关注的 3 只股票</CardTitle>
              <Badge variant="outline">关注名单</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {watchlistItems.length === 0 ? (
              <p className="empty md:col-span-3">当前没有足够样本生成关注名单。</p>
            ) : (
              watchlistItems.map((item) => (
                <div key={item.key} className="rounded-xl border bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</span>
                      <Badge variant="secondary">{item.category}</Badge>
                    </div>
                    <span className={`text-sm font-semibold ${changeTextClass(item.emphasisValue)}`}>
                      {item.emphasisValue !== null ? formatSignedPct(item.emphasisValue) : "-"}
                    </span>
                  </div>
                  <div className="mt-2">
                    {item.detailCompareUrl ? (
                      <Link href={item.detailCompareUrl} className="text-base font-medium hover:text-primary">
                        {item.company}
                      </Link>
                    ) : (
                      <p className="text-base font-medium">{item.company}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{item.symbol ?? "未映射 symbol"}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground/90">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.metrics.map((metric) => (
                      <span
                        key={`${item.key}-${metric.label}`}
                        className={`rounded-full border px-2.5 py-1 text-xs ${metricToneClass(metric.tone)}`}
                      >
                        {metric.label}: {metric.value}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border bg-background/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">为什么关注</p>
                    <div className="mt-3 space-y-2">
                      {item.observations.map((observation, index) => (
                        <div key={`${item.key}-observation-${index}`} className="flex items-start gap-2 text-sm leading-6">
                          <span className={`mt-2 h-1.5 w-1.5 rounded-full ${observation.tone === "positive" ? "bg-red-400" : observation.tone === "negative" ? "bg-emerald-400" : "bg-muted-foreground/70"}`} />
                          <p className="text-foreground/90">
                            <span className="font-medium">{observation.label}：</span>
                            {observation.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {item.compareTargetCompany ? (
                    <p className="mt-3 text-xs text-muted-foreground">默认对比标的：{item.compareTargetCompany}</p>
                  ) : null}
                  {item.detailCompareUrl ? (
                    <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                      <Link href={item.detailCompareUrl}>查看详情并带入默认对比</Link>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{date} AI 总览</CardTitle>
                <Badge variant="outline">{toReadableDate(date)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">股票市场</p>
                <p className="leading-7 text-foreground/90">{currentOverview.stockParagraph ?? "暂无股票市场总览。"}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">相关新闻</p>
                <p className="leading-7 text-foreground/90">{currentOverview.newsParagraph ?? "暂无新闻总览。"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{compareDate} AI 总览</CardTitle>
                <Badge variant="outline">{toReadableDate(compareDate)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">股票市场</p>
                <p className="leading-7 text-foreground/90">{previousOverview.stockParagraph ?? "暂无股票市场总览。"}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">相关新闻</p>
                <p className="leading-7 text-foreground/90">{previousOverview.newsParagraph ?? "暂无新闻总览。"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4" />
                股票变化榜
              </CardTitle>
              <p className="meta">按两天涨跌幅差值排序</p>
            </div>
          </CardHeader>
          <CardContent>
            {comparisonRows.length === 0 ? (
              <p className="empty">两天之间暂无可重叠的股票样本。</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>公司</TableHead>
                      <TableHead>{date}</TableHead>
                      <TableHead>{compareDate}</TableHead>
                      <TableHead className="text-right">涨跌幅差值</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.slice(0, 20).map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>
                          {renderCompanyCell(row)}
                          <div className="mt-1 text-xs text-muted-foreground">{row.symbol ?? "未映射 symbol"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{row.currentCloseText}</div>
                          <div className={`text-xs ${changeTextClass(row.currentChangeValue)}`}>{row.currentChangeText}</div>
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{row.previousCloseText}</div>
                          <div className={`text-xs ${changeTextClass(row.previousChangeValue)}`}>{row.previousChangeText}</div>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${changeTextClass(row.deltaValue)}`}>
                          {formatSignedPct(row.deltaValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                <CalendarDays className="mr-2 inline h-4 w-4" />
                {date} 独有样本
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {newlyAdded.length === 0 ? (
                <p className="empty">没有新增样本。</p>
              ) : (
                newlyAdded.map((row, index) => (
                  <div key={`added-${row.symbol ?? row.company}-${index}`} className="rounded-xl border bg-background/40 p-3">
                    {renderCompanyCell(row)}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.closeText} · <span className={changeTextClass(row.changeValue)}>{row.changeText}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                <Newspaper className="mr-2 inline h-4 w-4" />
                {compareDate} 独有样本
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {removed.length === 0 ? (
                <p className="empty">没有缺失样本。</p>
              ) : (
                removed.map((row, index) => (
                  <div key={`removed-${row.symbol ?? row.company}-${index}`} className="rounded-xl border bg-background/40 p-3">
                    {renderCompanyCell(row)}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.closeText} · <span className={changeTextClass(row.changeValue)}>{row.changeText}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
