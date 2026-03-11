import type { Language } from "@/lib/i18n";

export const REPORT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidReportDate(input: string): boolean {
  return REPORT_DATE_REGEX.test(input);
}

function parseReportDate(date: string): Date | null {
  if (!isValidReportDate(date)) {
    return null;
  }

  const [year, month, day] = date.split("-").map((part) => Number(part));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function addDaysToReportDate(date: string, offsetDays: number): string | null {
  const parsed = parseReportDate(date);
  if (!parsed) {
    return null;
  }

  parsed.setUTCDate(parsed.getUTCDate() + offsetDays);
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toReadableDate(date: string, language: Language = "zh"): string {
  const parsed = parseReportDate(date);
  if (!parsed) {
    return date;
  }

  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
}
