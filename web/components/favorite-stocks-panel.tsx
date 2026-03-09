"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StockListItem } from "@/lib/api";
import { getFavoriteStocks, subscribeFavoriteStocks } from "@/lib/favorite-stocks";
import type { ParsedReportStockRow } from "@/lib/report-parser";

type FavoriteStocksPanelProps = {
  rows: ParsedReportStockRow[];
  stockItems: StockListItem[];
};

type FavoriteStockView = {
  symbol: string;
  company: string;
  detailUrl: string;
  closeText: string;
  changeText: string;
  changeValue: number | null;
  newsCount: number;
};

function buildFavoriteViews(symbols: string[], rows: ParsedReportStockRow[], stockItems: StockListItem[]): FavoriteStockView[] {
  const rowBySymbol = new Map(
    rows
      .filter((row) => row.symbol)
      .map((row) => [row.symbol as string, row])
  );
  const stockBySymbol = new Map(stockItems.map((item) => [item.symbol, item]));

  return symbols
    .map((symbol) => {
      const row = rowBySymbol.get(symbol);
      const stock = stockBySymbol.get(symbol);
      if (!row && !stock) {
        return null;
      }

      return {
        symbol,
        company: row?.company || stock?.displayName || stock?.name || symbol,
        detailUrl: row?.detailUrl || `/stock/${encodeURIComponent(symbol)}`,
        closeText: row?.closeText || "今日暂无行情",
        changeText: row?.changeText || "-",
        changeValue: row?.changeValue ?? null,
        newsCount: row?.newsCount ?? 0
      };
    })
    .filter((item): item is FavoriteStockView => item !== null);
}

function changeTextClass(value: string): string {
  if (value.startsWith("+")) {
    return "text-red-400";
  }
  if (value.startsWith("-")) {
    return "text-emerald-400";
  }
  return "text-muted-foreground";
}

function pickSummaryItems(items: FavoriteStockView[]): {
  strongest: FavoriteStockView | null;
  weakest: FavoriteStockView | null;
  hottest: FavoriteStockView | null;
} {
  const withChange = items.filter((item) => item.changeValue !== null);
  const strongest =
    withChange.length > 0
      ? [...withChange].sort((a, b) => (b.changeValue ?? -Infinity) - (a.changeValue ?? -Infinity))[0]
      : null;
  const weakest =
    withChange.length > 0
      ? [...withChange].sort((a, b) => (a.changeValue ?? Infinity) - (b.changeValue ?? Infinity))[0]
      : null;
  const hottest =
    items.length > 0
      ? [...items].sort((a, b) => b.newsCount - a.newsCount || Math.abs(b.changeValue ?? 0) - Math.abs(a.changeValue ?? 0))[0]
      : null;

  return { strongest, weakest, hottest };
}

export function FavoriteStocksPanel(props: FavoriteStocksPanelProps) {
  const { rows, stockItems } = props;
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>([]);

  useEffect(() => {
    setFavoriteSymbols(getFavoriteStocks());
    return subscribeFavoriteStocks((symbols) => {
      setFavoriteSymbols(symbols);
    });
  }, []);

  const items = useMemo(() => buildFavoriteViews(favoriteSymbols, rows, stockItems), [favoriteSymbols, rows, stockItems]);
  const summary = useMemo(() => pickSummaryItems(items), [items]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">我的关注池</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-background/30 p-4">
            <p className="text-sm text-foreground/90">还没有加入自选股。</p>
            <p className="mt-1 text-sm text-muted-foreground">可以在首页股票表格或个股详情页点击星标，把常看的股票固定下来。</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              <div className="rounded-xl border bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">今日最强</p>
                <p className="mt-1 text-sm font-medium">{summary.strongest?.company ?? "暂无"}</p>
                <p className={`mt-1 text-sm font-semibold ${changeTextClass(summary.strongest?.changeText ?? "")}`}>
                  {summary.strongest?.changeText ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">今日最弱</p>
                <p className="mt-1 text-sm font-medium">{summary.weakest?.company ?? "暂无"}</p>
                <p className={`mt-1 text-sm font-semibold ${changeTextClass(summary.weakest?.changeText ?? "")}`}>
                  {summary.weakest?.changeText ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">消息最密集</p>
                <p className="mt-1 text-sm font-medium">{summary.hottest?.company ?? "暂无"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{summary.hottest ? `${summary.hottest.newsCount} 条相关新闻` : "-"}</p>
              </div>
            </div>

            {items.map((item) => (
              <Link
                key={item.symbol}
                href={item.detailUrl}
                className="flex items-center justify-between gap-3 rounded-xl border bg-background/40 p-3 transition hover:border-primary/50 hover:bg-background/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.company}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.symbol}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${changeTextClass(item.changeText)}`}>{item.changeText}</p>
                  <p className="text-xs text-muted-foreground">{item.closeText}</p>
                </div>
              </Link>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
