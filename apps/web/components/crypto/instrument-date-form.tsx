"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ReportDatePicker } from "@/components/report-date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isValidReportDate } from "@/lib/date";

type CryptoInstrumentDateFormProps = {
  value: string;
  label: string;
  submitLabel: string;
  invalidDateError: string;
};

export function CryptoInstrumentDateForm(props: CryptoInstrumentDateFormProps) {
  const { invalidDateError, label, submitLabel, value } = props;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(value);
    setError(null);
  }, [value]);

  function applyDate(): void {
    if (!isValidReportDate(date)) {
      setError(invalidDateError);
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("date", date);
    setError(null);
    router.push(`${pathname}?${nextSearchParams.toString()}`);
  }

  return (
    <div className="space-y-3">
      <Label className="text-muted-foreground">{label}</Label>
      <ReportDatePicker
        value={date}
        onChange={(nextDate) => {
          setDate(nextDate);
          setError(null);
        }}
      />
      <Button type="button" size="sm" variant="secondary" onClick={applyDate} className="w-full">
        {submitLabel}
      </Button>
      {error ? <p className="date-form-error">{error}</p> : null}
    </div>
  );
}
