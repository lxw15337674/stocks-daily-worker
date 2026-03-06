"use client";

import Link from "next/link";
import { CalendarSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchReportList, type ReportListItem } from "@/lib/public-api";

export default function ArchivePage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let items: ReportListItem[] = [];
      try {
        items = await fetchReportList(200);
      } catch {
        items = [];
      }

      if (!cancelled) {
        setReports(items);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page-shell">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarSearch className="h-5 w-5" />
            历史日报
          </CardTitle>
          <CardDescription>按美东交易日归档，点击日期可查看完整内容。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/">返回首页</Link>
          </Button>
          {loading ? (
            <Alert>
              <AlertDescription>正在加载历史数据...</AlertDescription>
            </Alert>
          ) : reports.length === 0 ? (
            <Alert>
              <AlertDescription>暂无历史数据。</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">交易日</TableHead>
                  <TableHead>生成时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((item) => (
                  <TableRow key={`${item.reportDateEt}-${item.createdAt}`}>
                    <TableCell>
                      <Link href={`/?date=${item.reportDateEt}`} className="font-medium text-primary hover:underline">
                        {item.reportDateEt}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
