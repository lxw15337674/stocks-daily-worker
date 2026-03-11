"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type JSX } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ReportStockRow = {
  company: string;
  code: string;
  symbol?: string | null;
  detailUrl?: string | null;
  xueqiuUrl: string | null;
  closeText: string;
  closeValue: number | null;
  changeText: string;
  changeValue: number | null;
};

type SortKey = "close" | "change";
type SortDirection = "asc" | "desc";

const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
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
  activeKey: SortKey | null;
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

type ReportStockTableProps = {
  rows: ReportStockRow[];
  variant?: "card" | "embedded";
  title?: string | null;
  description?: string | null;
};

export function ReportStockTable(props: ReportStockTableProps) {
  const {
    rows,
    variant = "card",
    title = "二、股票数据",
    description = "点击“收盘价 / 涨跌幅”列头可切换排序"
  } = props;
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_DIRECTION.change);
  const hasCodeColumn = rows.some((row) => row.code.trim().length > 0);
  const wrapperClass = variant === "embedded" ? "mb-6" : "mb-6 rounded-xl border bg-card/60 p-4";

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return rows;
    }

    const next = [...rows];
    next.sort((a, b) => {
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
    <section className={wrapperClass}>
      {title || description ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="font-serif text-xl font-bold tracking-tight">{title}</h2> : <span />}
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}

      <Table className="table-auto">
        <TableHeader>
          <TableRow>
            <TableHead>公司名称</TableHead>
            {hasCodeColumn ? <TableHead>股票代码</TableHead> : null}
            <SortableHead
              label="收盘价"
              sortKey="close"
              activeKey={sortKey}
              direction={sortKey === "close" ? sortDirection : DEFAULT_DIRECTION.close}
              onClick={toggleSort}
              align="right"
            />
            <SortableHead
              label="涨跌幅"
              sortKey="change"
              activeKey={sortKey}
              direction={sortKey === "change" ? sortDirection : DEFAULT_DIRECTION.change}
              onClick={toggleSort}
              align="right"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row, index) => (
            <TableRow key={`${row.company}-${row.code}-${index}`}>
              <TableCell className="font-medium break-words">
                {row.detailUrl ? (
                  <Link href={row.detailUrl} className="underline-offset-4 transition-colors hover:text-primary hover:underline">
                    {row.company}
                  </Link>
                ) : row.xueqiuUrl ? (
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
              {hasCodeColumn ? <TableCell className="break-words">{row.code || "-"}</TableCell> : null}
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
