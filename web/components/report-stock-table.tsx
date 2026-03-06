"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ReportStockRow = {
  rank: number | null;
  company: string;
  code: string;
  xueqiuUrl: string | null;
  closeText: string;
  closeValue: number | null;
  changeText: string;
  changeValue: number | null;
};

type SortKey = "rank" | "close" | "change";
type SortDirection = "asc" | "desc";

const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  rank: "asc",
  close: "desc",
  change: "desc"
};

function compareNullableNumbers(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  const diff = a - b;
  return direction === "asc" ? diff : -diff;
}

function changeValueClass(value: number | null): string {
  if (value === null) {
    return "text-muted-foreground";
  }
  if (value > 0) {
    return "text-red-400 font-semibold";
  }
  if (value < 0) {
    return "text-emerald-400 font-semibold";
  }
  return "text-slate-300";
}

function SortIndicator(props: { active: boolean; direction: SortDirection }) {
  if (!props.active) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  return props.direction === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 text-foreground" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-foreground" />
  );
}

function SortableHead(props: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onClick: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const { label, sortKey, activeKey, direction, onClick, align = "left" } = props;
  const isActive = activeKey === sortKey;
  const justifyClass = align === "right" ? "justify-end" : "justify-start";
  const textClass = align === "right" ? "text-right" : "text-left";

  return (
    <TableHead className={textClass}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex w-full items-center gap-1.5 ${justifyClass} text-muted-foreground transition-colors hover:text-foreground`}
      >
        <span>{label}</span>
        <SortIndicator active={isActive} direction={direction} />
      </button>
    </TableHead>
  );
}

export function ReportStockTable(props: { rows: ReportStockRow[] }) {
  const { rows } = props;
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      if (sortKey === "rank") {
        return compareNullableNumbers(a.rank, b.rank, sortDirection);
      }
      if (sortKey === "close") {
        return compareNullableNumbers(a.closeValue, b.closeValue, sortDirection);
      }
      return compareNullableNumbers(a.changeValue, b.changeValue, sortDirection);
    });
    return next;
  }, [rows, sortDirection, sortKey]);

  function toggleSort(nextKey: SortKey): void {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(DEFAULT_DIRECTION[nextKey]);
  }

  return (
    <section className="mb-6 rounded-xl border bg-card/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-bold tracking-tight">二、股票数据</h2>
        <p className="text-xs text-muted-foreground">点击“排名 / 收盘价 / 涨跌幅”列头可切换排序</p>
      </div>

      <Table className="table-auto">
        <TableHeader>
          <TableRow>
            <SortableHead
              label="排名"
              sortKey="rank"
              activeKey={sortKey}
              direction={sortDirection}
              onClick={toggleSort}
              align="right"
            />
            <TableHead>公司名称</TableHead>
            <TableHead>股票代码 </TableHead>
            <SortableHead
              label="收盘价"
              sortKey="close"
              activeKey={sortKey}
              direction={sortDirection}
              onClick={toggleSort}
              align="right"
            />
            <SortableHead
              label="涨跌幅"
              sortKey="change"
              activeKey={sortKey}
              direction={sortDirection}
              onClick={toggleSort}
              align="right"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row, index) => (
            <TableRow key={`${row.company}-${row.code}-${index}`}>
              <TableCell className="w-[1%] whitespace-nowrap text-right text-muted-foreground">{row.rank ?? "-"}</TableCell>
              <TableCell className="font-medium break-words">
                {row.xueqiuUrl ? (
                  <a
                    href={row.xueqiuUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {row.company}
                  </a>
                ) : (
                  row.company
                )}
              </TableCell>
              <TableCell className="break-words">{row.code}</TableCell>
              <TableCell className="w-[1%] whitespace-nowrap text-right">{row.closeText}</TableCell>
              <TableCell className={`w-[1%] whitespace-nowrap text-right ${changeValueClass(row.changeValue)}`}>
                {row.changeText}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
