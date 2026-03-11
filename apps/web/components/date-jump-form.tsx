"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { isValidReportDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ReportDatePicker } from "@/components/report-date-picker";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type DateJumpFormProps = {
  initialDate: string;
  label: string;
  submitLabel: string;
  className?: string;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  buttonClassName?: string;
};

export function DateJumpForm(props: DateJumpFormProps) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [date, setDate] = useState(props.initialDate);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(props.initialDate);
    setError(null);
  }, [props.initialDate]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidReportDate(date)) {
      setError(t("forms.invalidDateError"));
      return;
    }

    setError(null);
    router.push(`/?date=${encodeURIComponent(date)}`);
  }

  return (
    <form className={cn("space-y-2", props.className)} onSubmit={onSubmit}>
      <Label className="text-muted-foreground">{props.label}</Label>
      <ReportDatePicker
        value={date}
        onChange={(nextDate) => {
          setDate(nextDate);
          setError(null);
        }}
      />
      <Button
        type="submit"
        variant={props.buttonVariant ?? "default"}
        size={props.buttonSize ?? "default"}
        className={cn("w-full gap-1.5", props.buttonClassName)}
      >
        <CalendarDays className="h-4 w-4" />
        {props.submitLabel}
      </Button>
      {error ? <p className="date-form-error">{error}</p> : null}
    </form>
  );
}
