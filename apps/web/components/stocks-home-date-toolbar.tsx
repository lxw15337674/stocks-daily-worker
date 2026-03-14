"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

type StocksHomeDateToolbarProps = {
  lang: Language;
  date: string;
  previousDate: string | null;
  nextDate: string | null;
};

function DateNavButton(props: {
  href: string | null;
  direction: "previous" | "next";
  label: string;
}) {
  const { href, direction, label } = props;
  if (!href) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        {direction === "previous" ? <ChevronLeft className="h-3.5 w-3.5" /> : null}
        {label}
        {direction === "next" ? <ChevronRight className="h-3.5 w-3.5" /> : null}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        {direction === "previous" ? <ChevronLeft className="h-3.5 w-3.5" /> : null}
        {label}
        {direction === "next" ? <ChevronRight className="h-3.5 w-3.5" /> : null}
      </Link>
    </Button>
  );
}

export function StocksHomeDateToolbar(props: StocksHomeDateToolbarProps) {
  const { lang, date, previousDate, nextDate } = props;
  const { t } = useTranslation("stocks");
  const homeHref = assetHomePath(lang, "stocks");
  const toDateHref = (targetDate: string | null): string | null =>
    targetDate ? `${homeHref}?date=${encodeURIComponent(targetDate)}` : null;

  return (
    <div className="w-full sm:w-fit sm:ml-auto">
      <Card size="sm" className="bg-card/80">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-2 sm:justify-start">
          <DateNavButton href={toDateHref(previousDate)} direction="previous" label={t("home.previousDay")} />
          <form className="flex min-w-0 items-center gap-2" action={homeHref} method="get">
            <Input
              id="stocks-report-date"
              name="date"
              type="date"
              defaultValue={date}
              required
              className="h-8 w-[10.5rem] bg-background/70 text-sm"
              aria-label={t("home.chooseDate")}
            />
            <Button type="submit" variant="secondary" size="sm" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("home.jump")}
            </Button>
          </form>
          <DateNavButton href={toDateHref(nextDate)} direction="next" label={t("home.nextDay")} />
        </CardContent>
      </Card>
    </div>
  );
}
