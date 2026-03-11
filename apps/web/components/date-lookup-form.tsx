"use client";

import { useTranslation } from "react-i18next";

import { DateJumpForm } from "@/components/date-jump-form";

function todayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DateLookupForm(props: { initialValue?: string }) {
  const { t } = useTranslation("common");

  return (
    <DateJumpForm
      initialDate={props.initialValue ?? todayDateString()}
      label={t("forms.lookupByDateLabel")}
      submitLabel={t("forms.lookupSubmitLabel")}
      className="mt-5"
    />
  );
}
