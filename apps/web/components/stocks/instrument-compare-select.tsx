"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Language } from "@/lib/i18n";
import { assetInstrumentPath } from "@/lib/platform-routes";

type CompareOption = {
  symbol: string;
  displayName: string;
};

type InstrumentCompareSelectProps = {
  lang: Language;
  currentSymbol: string;
  compareSymbol: string | null;
  options: CompareOption[];
  label: string;
  placeholder: string;
  submitLabel: string;
  clearLabel: string;
};

export function InstrumentCompareSelect(props: InstrumentCompareSelectProps) {
  const { clearLabel, compareSymbol, currentSymbol, label, lang, options, placeholder, submitLabel } = props;
  const router = useRouter();
  const basePath = assetInstrumentPath(lang, "stocks", currentSymbol);
  const [selectedSymbol, setSelectedSymbol] = useState(compareSymbol ?? "");

  useEffect(() => {
    setSelectedSymbol(compareSymbol ?? "");
  }, [compareSymbol]);

  function applyCompare(): void {
    router.push(selectedSymbol ? `${basePath}?compare=${encodeURIComponent(selectedSymbol)}` : basePath);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border bg-background/40 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              {options.map((item) => (
                <SelectItem key={item.symbol} value={item.symbol}>
                  {item.displayName}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={applyCompare}>
          <ArrowLeftRight data-icon="inline-start" />
          {submitLabel}
        </Button>
        {compareSymbol ? (
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={basePath}>{clearLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
