import type { Language } from "@/lib/i18n";

export function formatPrice(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 2 : 4,
    maximumFractionDigits: value >= 100 ? 2 : 4
  }).format(value);
}

export function formatCompactCurrency(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatSignedPercent(value: number): string {
  const rounded = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

export function formatShare(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(value: string, language: Language): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC"
  }).format(date);
}

export function formatDateTime(value: string, language: Language): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date);
}
