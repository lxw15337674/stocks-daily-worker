"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ChevronLeft, ChevronRight, Globe2, Newspaper, ScrollText, TrendingUp } from "lucide-react";

import { HomeMarketPulseArchive } from "@/components/stocks/home-market-pulse-archive";
import { HomeMarketPulseLive } from "@/components/stocks/home-market-pulse-live";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { Button } from "@/components/ui/button";
import { HomeContentTabs } from "@/components/home-content-tabs";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import {
  useReportList,
  useStockDetails,
  useStockList,
  useStockReportByDate
} from "@/lib/api";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { addDaysToReportDate, isValidReportDate, toReadableDate } from "@/lib/date";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath, assetInstrumentPath, stocksMarketPath } from "@/lib/platform-routes";
import { getTodayMarketDate } from "@/lib/stocks-market";
import { buildParsedRowsFromStockReport, resolveLocalizedText } from "@/lib/stocks-report";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type HomePageProps = {
  lang?: Language;
  date?: string;
};

const HOME_SECTION_IDS = {
  marketPulse: "stocks-home-market-pulse",
  featured: "stocks-home-featured",
  report: "stocks-home-report",
  news: "stocks-home-news",
  movers: "stocks-home-movers"
} as const;

type HomeQuickNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

function buildHomeDateHref(lang: Language, targetDate: string | null): string | null {
  return targetDate ? `${assetHomePath(lang, "stocks")}?date=${encodeURIComponent(targetDate)}` : null;
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

function HomeSidebarDateControls(props: {
  lang: Language;
  date: string;
  previousDate: string | null;
  nextDate: string | null;
  groupLabel: string;
}) {
  const { lang, date, previousDate, nextDate, groupLabel } = props;
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const stocksT = getFixedT(lang, "stocks", "home");
  const [selectedDate, setSelectedDate] = useState(date);

  useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  function closeSidebarOnMobile() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidReportDate(selectedDate)) {
      return;
    }

    closeSidebarOnMobile();
    router.push(buildHomeDateHref(lang, selectedDate) ?? assetHomePath(lang, "stocks"));
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="flex flex-col gap-3 px-2 py-1.5">
          <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {stocksT("tradingDate")}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{date}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {previousDate ? (
              <Button asChild variant="outline" size="sm" className="w-full justify-center">
                <Link href={buildHomeDateHref(lang, previousDate) ?? "#"} onClick={closeSidebarOnMobile}>
                  <ChevronLeft />
                  {stocksT("previousDay")}
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-full justify-center" disabled>
                <ChevronLeft />
                {stocksT("previousDay")}
              </Button>
            )}

            {nextDate ? (
              <Button asChild variant="outline" size="sm" className="w-full justify-center">
                <Link href={buildHomeDateHref(lang, nextDate) ?? "#"} onClick={closeSidebarOnMobile}>
                  {stocksT("nextDay")}
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-full justify-center" disabled>
                {stocksT("nextDay")}
                <ChevronRight />
              </Button>
            )}
          </div>

          <form className="flex flex-col gap-2" onSubmit={onSubmit}>
            <Input
              id="stocks-sidebar-report-date"
              name="date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              required
              className="bg-background/70 text-sm"
              aria-label={stocksT("chooseDate")}
            />
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              <CalendarDays />
              {stocksT("jump")}
            </Button>
          </form>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function HomeQuickNav(props: { items: HomeQuickNavItem[]; activeId: string; groupLabel: string }) {
  const { items, activeId, groupLabel } = props;
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={activeId === item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => {
                  if (isMobile) {
                    setOpenMobile(false);
                  }
                }}
              >
                <item.icon />
                <span>{item.label}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export default function HomePage(props: HomePageProps) {
  const lang = props.lang ?? "zh";
  const channelT = getFixedT(lang, "channel", "stocks");
  const stocksT = getFixedT(lang, "stocks", "home");
  const moversT = getFixedT(lang, "stocks", "movers");
  const queryDate = props.date?.trim() ?? "";
  const { data: history = [], isLoading: isHistoryLoading } = useReportList(120);
  const { data: stockItems = [], isLoading: isStockItemsLoading } = useStockList();
  const todayDate = getTodayMarketDate();

  const date = isValidReportDate(queryDate) ? queryDate : history[0]?.reportDateEt ?? todayDate;
  const { data: report, isLoading: isReportLoading } = useStockReportByDate(date);

  const reportRows = useMemo(() => (report ? buildParsedRowsFromStockReport(report, lang) : []), [report, lang]);
  const tableSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          reportRows
            .map((row) => row.symbol)
            .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0)
        )
      ),
    [reportRows]
  );
  const { data: stockDetails = [], isLoading: isStockDetailsLoading } = useStockDetails(tableSymbols);
  const quickNavItems = useMemo<HomeQuickNavItem[]>(
    () => [
      { id: HOME_SECTION_IDS.marketPulse, label: stocksT("marketPulseTitle"), icon: Globe2 },
      { id: HOME_SECTION_IDS.featured, label: stocksT("featuredTitle"), icon: Newspaper },
      { id: HOME_SECTION_IDS.report, label: stocksT("fullReport"), icon: ScrollText },
      { id: HOME_SECTION_IDS.news, label: stocksT("companyNewsTitle"), icon: TrendingUp },
      { id: HOME_SECTION_IDS.movers, label: moversT("title"), icon: TrendingUp }
    ],
    [moversT, stocksT]
  );
  const activeQuickNavId = useScrollSpy(quickNavItems.map((item) => item.id), { offset: 128 });
  const quickNavLabel = lang === "zh" ? "快速定位" : "Quick Navigation";
  const dateGroupLabel = lang === "zh" ? "时间切换" : "Date";
  const isTodayView = date === todayDate;

  if (isHistoryLoading || isStockItemsLoading || isReportLoading || isStockDetailsLoading) {
    return <RouteSegmentLoading title="Loading stocks" description={channelT("loading")} />;
  }

  const previousDate = addDaysToReportDate(date, -1);
  const nextDate = addDaysToReportDate(date, 1);
  const stockItemBySymbol = new Map(stockItems.map((item) => [item.symbol, item]));
  const detailBySymbol = new Map(stockDetails.map((detail) => [detail.stock.symbol, detail]));
  const streakBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, calculateLatestStreak((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.changePct))])
  );
  const recentFiveDayReturnBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, calculateRecentReturn((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.close), 5)])
  );
  const recentPositiveDaysBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, countDirectionalDays((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.changePct), 5, "up")])
  );
  const recentNegativeDaysBySymbol = new Map(
    tableSymbols.map((symbol) => [symbol, countDirectionalDays((detailBySymbol.get(symbol)?.history ?? []).map((item) => item.changePct), 5, "down")])
  );
  const recentFiveDayNewsCountBySymbol = new Map(
    tableSymbols.map((symbol) => [
      symbol,
      countRecentNewsByDays((detailBySymbol.get(symbol)?.recentNews ?? []).map((item) => item.publishedAt), date, 5)
    ])
  );

  const enhancedRows: ParsedReportStockRow[] =
    reportRows.map((row) => ({
      ...row,
      businessType: row.symbol ? (stockItemBySymbol.get(row.symbol)?.businessType ?? null) : null,
      detailUrl: row.symbol ? assetInstrumentPath(lang, "stocks", row.symbol) : row.detailUrl,
      newsCount: row.symbol ? (row.newsCount ?? 0) : 0,
      streak: row.symbol ? (streakBySymbol.get(row.symbol) ?? { direction: "flat", count: 0 }) : { direction: "flat", count: 0 },
      recentFiveDayReturn: row.symbol ? (recentFiveDayReturnBySymbol.get(row.symbol) ?? null) : null,
      recentFiveDayNewsCount: row.symbol ? (recentFiveDayNewsCountBySymbol.get(row.symbol) ?? 0) : 0,
      recentPositiveDays: row.symbol ? (recentPositiveDaysBySymbol.get(row.symbol) ?? 0) : 0,
      recentNegativeDays: row.symbol ? (recentNegativeDaysBySymbol.get(row.symbol) ?? 0) : 0
    }));

  return (
    <SidebarProvider defaultOpen>
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarContent>
          <HomeSidebarDateControls
            lang={lang}
            date={date}
            previousDate={previousDate}
            nextDate={nextDate}
            groupLabel={dateGroupLabel}
          />
          <SidebarSeparator />
          <HomeQuickNav items={quickNavItems} activeId={activeQuickNavId} groupLabel={quickNavLabel} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="page-shell">
          <div className="mb-3 flex items-center gap-2 md:hidden">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">{quickNavLabel}</span>
          </div>

          <div className="space-y-6">
            <section id={HOME_SECTION_IDS.marketPulse} className="scroll-mt-24">
              {isTodayView ? (
                <HomeMarketPulseLive
                  lang={lang}
                  todayDate={todayDate}
                  title={stocksT("marketPulseTitle")}
                  description={stocksT("marketPulseDescription")}
                  actionHref={stocksMarketPath(lang)}
                  actionLabel={stocksT("marketPulseAction")}
                />
              ) : (
                <HomeMarketPulseArchive
                  lang={lang}
                  date={date}
                  title={stocksT("marketPulseTitle")}
                  description={stocksT("marketPulseArchiveDescription")}
                  actionHref={`${stocksMarketPath(lang)}?summaryDate=${encodeURIComponent(date)}`}
                  actionLabel={stocksT("marketPulseAction")}
                />
              )}
            </section>

            <HomeContentTabs
              lang={lang}
              date={date}
              readableDate={toReadableDate(date, lang)}
              rows={enhancedRows}
              overview={report ? resolveLocalizedText(report.overview.brief, lang) : null}
              newsGroups={
                report
                  ? report.newsGroups.map((group) => ({
                      ...group,
                      detailUrl: assetInstrumentPath(lang, "stocks", group.symbol)
                    }))
                  : []
              }
              reportMeta={{
                generatedAt: report?.createdAt,
                sampleScope: report ? String(report.sampleSize) : undefined,
                validQuotes: report ? String(report.validQuoteCount) : undefined
              }}
              sectionIds={{
                featured: HOME_SECTION_IDS.featured,
                report: HOME_SECTION_IDS.report,
                news: HOME_SECTION_IDS.news,
                movers: HOME_SECTION_IDS.movers
              }}
            />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
