"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Globe2, Newspaper, ScrollText, TrendingUp } from "lucide-react";

import { MarketStatusGrid } from "@/components/stocks/market-status-grid";
import { StocksHomeDateToolbar } from "@/components/stocks-home-date-toolbar";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { StatusCard } from "@/components/platform/status-card";
import { Button } from "@/components/ui/button";
import { HomeContentTabs } from "@/components/home-content-tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import {
  useReportList,
  useStockDetails,
  useStockList,
  useStockReportByDate
} from "@/lib/api";
import { addDaysToReportDate, isValidReportDate, toReadableDate } from "@/lib/date";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath, assetInstrumentPath, stocksMarketPath } from "@/lib/platform-routes";
import { useHomeMarketPulse } from "@/lib/stocks-market";
import { buildParsedRowsFromStockReport, resolveLocalizedText } from "@/lib/stocks-report";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type HomePageProps = {
  lang?: Language;
  date?: string;
};

const HOME_SECTION_IDS = {
  date: "stocks-home-date",
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

function HomeQuickNav(props: { items: HomeQuickNavItem[]; activeId: string; groupLabel: string }) {
  const { items, activeId, groupLabel } = props;
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarContent>
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
    </SidebarContent>
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
  const { data: marketPulse, isLoading: isMarketPulseLoading } = useHomeMarketPulse();

  const date = isValidReportDate(queryDate) ? queryDate : history[0]?.reportDateEt ?? getTodayEtDateString();
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
      { id: HOME_SECTION_IDS.date, label: stocksT("tradingDate"), icon: CalendarDays },
      { id: HOME_SECTION_IDS.marketPulse, label: stocksT("marketPulseTitle"), icon: Globe2 },
      { id: HOME_SECTION_IDS.featured, label: stocksT("featuredTitle"), icon: Newspaper },
      { id: HOME_SECTION_IDS.report, label: stocksT("fullReport"), icon: ScrollText },
      { id: HOME_SECTION_IDS.news, label: stocksT("companyNewsTitle"), icon: TrendingUp },
      { id: HOME_SECTION_IDS.movers, label: moversT("title"), icon: TrendingUp }
    ],
    [moversT, stocksT]
  );
  const [activeQuickNavId, setActiveQuickNavId] = useState<string>(HOME_SECTION_IDS.date);
  const quickNavLabel = lang === "zh" ? "快速定位" : "Quick Navigation";

  useEffect(() => {
    const sections = quickNavItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (activeEntries[0]?.target.id) {
          setActiveQuickNavId(activeEntries[0].target.id);
        }
      },
      {
        threshold: [0.2, 0.5, 0.8],
        rootMargin: "-20% 0px -60% 0px"
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [quickNavItems]);

  if (isHistoryLoading || isStockItemsLoading || isMarketPulseLoading || isReportLoading || isStockDetailsLoading || !marketPulse) {
    return <RouteSegmentLoading title="Loading stocks" description={channelT("loading")} />;
  }

  if (!report) {
    return (
      <StatusCard title={channelT("missingReportTitle")} body={channelT("missingReportDescription")}>
        <Button asChild>
          <Link href={assetHomePath(lang, "stocks")}>{channelT("backToChannelHome")}</Link>
        </Button>
      </StatusCard>
    );
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
        <HomeQuickNav items={quickNavItems} activeId={activeQuickNavId} groupLabel={quickNavLabel} />
      </Sidebar>
      <SidebarInset>
        <main className="page-shell">
          <div className="mb-3 flex items-center gap-2 md:hidden">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">{quickNavLabel}</span>
          </div>

          <div className="space-y-6">
            <section id={HOME_SECTION_IDS.date} className="scroll-mt-24">
              <StocksHomeDateToolbar
                lang={lang}
                date={date}
                previousDate={previousDate}
                nextDate={nextDate}
              />
            </section>

            <section id={HOME_SECTION_IDS.marketPulse} className="scroll-mt-24">
              <MarketStatusGrid
                lang={lang}
                latest={marketPulse.latest}
                summary={marketPulse.summary}
                title={stocksT("marketPulseTitle")}
                description={stocksT("marketPulseDescription")}
                actionHref={stocksMarketPath(lang)}
                actionLabel={stocksT("marketPulseAction")}
              />
            </section>

            <HomeContentTabs
              lang={lang}
              date={date}
              readableDate={toReadableDate(date, lang)}
              rows={enhancedRows}
              overview={resolveLocalizedText(report.overview.brief, lang)}
              newsGroups={report.newsGroups.map((group) => ({
                ...group,
                detailUrl: assetInstrumentPath(lang, "stocks", group.symbol)
              }))}
              reportMeta={{
                generatedAt: report.createdAt,
                sampleScope: String(report.sampleSize),
                validQuotes: String(report.validQuoteCount)
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
