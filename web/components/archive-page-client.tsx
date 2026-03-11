"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchReportsClient } from "@/lib/client-api";
import type { ReportListItem } from "@/lib/crypto-types";
import { formatCompactCurrency, formatDate, formatDateTime } from "@/lib/format";
import { getDictionary, type Language } from "@/lib/i18n";

type Props = {
  lang: Language;
};

export function ArchivePageClient(props: Props) {
  const { lang } = props;
  const dict = getDictionary(lang);
  const [reports, setReports] = useState<ReportListItem[] | null>(null);

  const loadReports = useEffectEvent(async () => {
    const nextReports = await fetchReportsClient(120);
    startTransition(() => {
      setReports(nextReports);
    });
  });

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>{dict.archiveTitle}</CardTitle>
          <CardDescription>{dict.archiveDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {reports === null ? (
            <p className="empty">{lang === "zh" ? "加载中..." : "Loading..."}</p>
          ) : reports.length === 0 ? (
            <p className="empty">{dict.noData}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.reportDate}</TableHead>
                    <TableHead>{dict.generatedAt}</TableHead>
                    <TableHead className="text-right">{dict.totalVolume}</TableHead>
                    <TableHead>{dict.breadth}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.reportDate}>
                      <TableCell>
                        <Link href={`/${lang}/report/${report.reportDate}`} className="font-medium text-primary hover:underline">
                          {formatDate(report.reportDate, lang)}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDateTime(report.generatedAt, lang)}</TableCell>
                      <TableCell className="text-right">{formatCompactCurrency(report.totalQuoteVolumeUsdt, lang)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lang === "zh"
                          ? `涨 ${report.upCount} / 跌 ${report.downCount} / 平 ${report.flatCount}`
                          : `Up ${report.upCount} / Down ${report.downCount} / Flat ${report.flatCount}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
