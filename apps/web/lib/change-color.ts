import type { Language } from "@/lib/i18n";

export type ChangeTone = "positive" | "negative" | "neutral";

function usesCnColorConvention(lang: Language): boolean {
  return lang === "zh";
}

export function getChangeTone(value: number | null | undefined): ChangeTone {
  if (value === null || value === undefined || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}

export function getChangeTextClass(lang: Language, value: number | null | undefined): string {
  const tone = getChangeTone(value);
  if (tone === "neutral") {
    return "text-muted-foreground";
  }

  const positiveClass = usesCnColorConvention(lang) ? "text-red-400" : "text-emerald-400";
  const negativeClass = usesCnColorConvention(lang) ? "text-emerald-400" : "text-red-400";
  return tone === "positive" ? positiveClass : negativeClass;
}

export function getChangeTextClassStrong(lang: Language, value: number | null | undefined): string {
  const base = getChangeTextClass(lang, value);
  return base === "text-muted-foreground" ? base : `${base} font-semibold`;
}

export function getChangeToneBadgeClass(lang: Language, tone: ChangeTone): string {
  if (tone === "neutral") {
    return "border-border/70 bg-background/50 text-muted-foreground";
  }

  const positiveClass = usesCnColorConvention(lang)
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  const negativeClass = usesCnColorConvention(lang)
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-red-500/30 bg-red-500/10 text-red-300";

  return tone === "positive" ? positiveClass : negativeClass;
}

export function getChangePanelClass(lang: Language, value: number | null | undefined): string {
  const tone = getChangeTone(value);
  if (tone === "neutral") {
    return "border-border/70 bg-background/50 text-muted-foreground";
  }

  const positiveClass = usesCnColorConvention(lang)
    ? "border-red-500/30 bg-red-500/10 text-red-200"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  const negativeClass = usesCnColorConvention(lang)
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-red-500/30 bg-red-500/10 text-red-200";

  return tone === "positive" ? positiveClass : negativeClass;
}
