"use client";

import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { isValidReportDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ReportDatePickerProps = {
  value: string;
  onChange: (nextDate: string) => void;
  className?: string;
  placeholder?: string;
};

function parseReportDateForPicker(input: string): Date | undefined {
  if (!isValidReportDate(input)) {
    return undefined;
  }

  const [year, month, day] = input.split("-").map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function toReportDateString(input: Date): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDisplayDate(input: string): string {
  return input.replace(/-/g, "/");
}

export function ReportDatePicker(props: ReportDatePickerProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseReportDateForPicker(props.value), [props.value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between text-left font-normal",
            !selected && "text-muted-foreground",
            props.className
          )}
        >
          {selected ? toDisplayDate(props.value) : (props.placeholder ?? t("forms.selectDatePlaceholder"))}
          <CalendarDays className="h-4 w-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(nextDate) => {
            if (!nextDate) {
              return;
            }
            props.onChange(toReportDateString(nextDate));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
