"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchReportByDate } from "@/lib/public-api";
import { addDaysToReportDate, isValidReportDate, toReadableDate } from "@/lib/date";

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams<{ date?: string }>();
  const date = typeof params?.date === "string" ? params.date : "";
  const validDate = isValidReportDate(date);

  const [loading, setLoading] = useState(true);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState(date);
  const [dateInputError, setDateInputError] = useState<string | null>(null);

  const previousDate = validDate ? addDaysToReportDate(date, -1) : null;
  const nextDate = validDate ? addDaysToReportDate(date, 1) : null;

  useEffect(() => {
    setDateInput(date);
    setDateInputError(null);
  }, [date]);

  useEffect(() => {
    let cancelled = false;

    if (!validDate) {
      setMarkdown(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      let content: string | null = null;
      try {
        content = await fetchReportByDate(date);
      } catch {
        content = null;
      }

      if (!cancelled) {
        setMarkdown(content);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, validDate]);

  function onDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidReportDate(dateInput)) {
      setDateInputError("请输入 YYYY-MM-DD 格式日期。");
      return;
    }

    setDateInputError(null);
    router.push(`/report/${dateInput}`);
  }

  if (loading) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>正在加载日报...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!validDate || !markdown) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>未找到对应日报</CardTitle>
            <p className="meta mt-1">请确认日期格式为 YYYY-MM-DD，并且该交易日已经生成报告。</p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl">{date}</CardTitle>
            <p className="meta mt-1">美东交易日：{toReadableDate(date)}</p>
            <form className="mt-3 space-y-2" onSubmit={onDateSubmit}>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={dateInput}
                  onChange={(event) => setDateInput(event.target.value)}
                  className="w-[180px]"
                  required
                />
                <Button type="submit" variant="secondary" size="sm" className="gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  跳转日期
                </Button>
              </div>
              {dateInputError ? <p className="date-form-error">{dateInputError}</p> : null}
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">按日期查询</Badge>
            {previousDate ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/report/${previousDate}`}>
                  <ChevronLeft className="h-4 w-4" />
                  前一天
                </Link>
              </Button>
            ) : null}
            {nextDate ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/report/${nextDate}`}>
                  后一天
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/archive">历史</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/">首页</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <article className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </main>
  );
}
