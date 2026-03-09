"use client";

import { DateJumpForm } from "@/components/date-jump-form";

function todayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DateLookupForm(props: { initialValue?: string }) {
  return (
    <DateJumpForm
      initialDate={props.initialValue ?? todayDateString()}
      label="按日期查询（美东交易日）"
      submitLabel="查看日报"
      className="mt-5"
    />
  );
}
