"use client";

import { useMemo, useTransition } from "react";
import type { MarketIndexHistoryResponse, MarketIndexLatestResponse, MarketIndexRange } from "@china-stocks/contracts";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MarketChartClientProps = {
  lang: "zh" | "en";
  latest: MarketIndexLatestResponse | null;
  initialRange: MarketIndexRange;
  initialHistory: MarketIndexHistoryResponse | null;
  initialSelectedKeys: string[];
};

type ChartRow = {
  tradingDate: string;
  label: string;
  [indexKey: string]: number | string | null;
};

const RANGE_OPTIONS: MarketIndexRange[] = ["1m", "3m", "1y"];
const LINE_COLORS: string[] = ["#f97316", "#38bdf8", "#f43f5e", "#22c55e", "#a855f7", "#eab308", "#14b8a6", "#fb7185"];

function formatAxisDate(value: string, lang: "zh" | "en"): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function normalizeSeries(history: MarketIndexHistoryResponse | null, selectedKeys: string[], lang: "zh" | "en"): ChartRow[] {
  if (!history) {
    return [];
  }

  const selectedSeries = history.series.filter((item) => selectedKeys.includes(item.indexKey));
  if (selectedSeries.length === 0) {
    return [];
  }

  const rowByDate = new Map<string, ChartRow>();

  for (const series of selectedSeries) {
    const firstPoint = series.points.find((point) => point.close > 0) ?? null;
    if (!firstPoint) {
      continue;
    }

    for (const point of series.points) {
      const current = rowByDate.get(point.tradingDate) ?? {
        tradingDate: point.tradingDate,
        label: formatAxisDate(point.tradingDate, lang)
      };
      current[series.indexKey] = (point.close / firstPoint.close) * 100;
      rowByDate.set(point.tradingDate, current);
    }
  }

  return [...rowByDate.values()].sort((left, right) => left.tradingDate.localeCompare(right.tradingDate));
}

function resolveIndexLabel(
  latest: MarketIndexLatestResponse | null,
  history: MarketIndexHistoryResponse | null,
  lang: "zh" | "en",
  indexKey: string
): string {
  const latestItem = latest?.regions.flatMap((region) => region.items).find((item) => item.indexKey === indexKey) ?? null;
  if (latestItem) {
    return lang === "zh" ? latestItem.nameZh : latestItem.nameEn;
  }

  const series = history?.series.find((item) => item.indexKey === indexKey) ?? null;
  if (series) {
    return lang === "zh" ? series.nameZh : series.nameEn;
  }

  return indexKey;
}

function resolveDefaultSelectedKeys(latest: MarketIndexLatestResponse | null, history: MarketIndexHistoryResponse | null): string[] {
  const preferred = latest?.regions.map((region) => region.primaryIndexKey).filter((item) => item.length > 0) ?? [];
  if (preferred.length > 0) {
    return preferred;
  }

  return history?.series.slice(0, 3).map((item) => item.indexKey) ?? [];
}

export function MarketChartClient(props: MarketChartClientProps) {
  const { initialHistory, initialRange, initialSelectedKeys, lang, latest } = props;
  const { t } = useTranslation("stocks");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const history = initialHistory;
  const selectedKeys =
    initialSelectedKeys.length > 0 ? initialSelectedKeys : resolveDefaultSelectedKeys(latest, initialHistory);
  const range = initialRange;
  const allItems = useMemo(() => latest?.regions.flatMap((region) => region.items) ?? [], [latest]);

  const chartData = useMemo(() => normalizeSeries(history, selectedKeys, lang), [history, lang, selectedKeys]);
  const seriesList = history?.series.filter((item) => selectedKeys.includes(item.indexKey)) ?? [];

  function updateUrl(nextRange: MarketIndexRange, nextSelectedKeys: string[]): void {
    const query = new URLSearchParams(searchParams.toString());
    query.set("range", nextRange);
    query.set("indexKeys", nextSelectedKeys.join(","));

    startTransition(() => {
      router.replace(query.size > 0 ? `${pathname}?${query.toString()}` : pathname, { scroll: false });
    });
  }

  function toggleIndex(indexKey: string) {
    const nextSelectedKeys = selectedKeys.includes(indexKey)
      ? selectedKeys.length > 1
        ? selectedKeys.filter((item) => item !== indexKey)
        : selectedKeys
      : [...selectedKeys, indexKey];

    updateUrl(range, nextSelectedKeys);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((item) => (
            <Button
              key={item}
              type="button"
              variant={item === range ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateUrl(item, selectedKeys)}
            >
              {item === "1m" ? t("market.range1m") : item === "3m" ? t("market.range3m") : t("market.range1y")}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isPending ? <Badge variant="outline">{t("market.chartLoading")}</Badge> : null}
          <Badge variant="outline">{`${selectedKeys.length}/${allItems.length || selectedKeys.length}`}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {allItems.map((item) => (
          <Button
            key={item.indexKey}
            type="button"
            variant={selectedKeys.includes(item.indexKey) ? "secondary" : "outline"}
            size="sm"
            onClick={() => toggleIndex(item.indexKey)}
            className="h-auto min-h-8 px-3 py-2"
          >
            <span className="flex flex-col items-start gap-1 text-left leading-none">
              <span>{lang === "zh" ? item.nameZh : item.nameEn}</span>
              {item.isPrimary ? <span className="text-[11px] opacity-75">{t("market.primaryLabel")}</span> : null}
            </span>
          </Button>
        ))}
      </div>

      {chartData.length === 0 || seriesList.length === 0 ? (
        <p className="empty">{t("market.chartEmpty")}</p>
      ) : (
        <div className="h-[360px] rounded-2xl border border-border/70 bg-background/40 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
              <XAxis dataKey="label" minTickGap={24} tick={{ fill: "currentColor", fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                domain={["dataMin - 2", "dataMax + 2"]}
                tickFormatter={(value: number) => `${value.toFixed(0)}`}
                tick={{ fill: "currentColor", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip
                formatter={(value, name) => [
                  typeof value === "number" ? value.toFixed(2) : String(value ?? "-"),
                  resolveIndexLabel(latest, history, lang, String(name ?? ""))
                ]}
                labelFormatter={(value) => String(value ?? "")}
                contentStyle={{
                  background: "rgba(15, 23, 42, 0.92)",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  borderRadius: 14
                }}
              />
              <Legend
                formatter={(value: string) => resolveIndexLabel(latest, history, lang, value)}
                wrapperStyle={{ fontSize: "12px" }}
              />
              {seriesList.map((series, index) => (
                <Line
                  key={series.indexKey}
                  type="monotone"
                  dataKey={series.indexKey}
                  stroke={LINE_COLORS[index % LINE_COLORS.length]}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
