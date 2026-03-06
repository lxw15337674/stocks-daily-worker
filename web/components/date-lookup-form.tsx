"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { isValidReportDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function todayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DateLookupForm(props: { initialValue?: string }) {
  const router = useRouter();
  const initial = useMemo(() => props.initialValue ?? todayDateString(), [props.initialValue]);
  const [date, setDate] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidReportDate(date)) {
      setError("请输入 YYYY-MM-DD 格式，例如 2026-03-06。");
      return;
    }
    setError(null);
    router.push(`/report/${date}`);
  }

  return (
    <form className="mt-5 space-y-2" onSubmit={onSubmit}>
      <label htmlFor="report-date" className="text-sm font-medium text-muted-foreground">
        按日期查询（美东交易日）
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="report-date"
          name="report-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
          className="sm:max-w-[230px]"
        />
        <Button type="submit" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          查看日报
        </Button>
      </div>
      {error ? <p className="date-form-error">{error}</p> : null}
    </form>
  );
}
