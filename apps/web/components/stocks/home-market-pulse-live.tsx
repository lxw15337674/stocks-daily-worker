"use client";

import type { Language } from "@/lib/i18n";
import { useHomeLiveMarketPulse } from "@/lib/stocks-market";
import { MarketStatusGrid } from "./market-status-grid";

type HomeMarketPulseLiveProps = {
  lang: Language;
  todayDate: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

export function HomeMarketPulseLive(props: HomeMarketPulseLiveProps) {
  const { actionHref, actionLabel, description, lang, title, todayDate } = props;
  const { data } = useHomeLiveMarketPulse(todayDate);

  return (
    <MarketStatusGrid
      lang={lang}
      latest={data?.latest ?? null}
      summaries={data?.summaries ?? []}
      variant="live"
      title={title}
      description={description}
      actionHref={actionHref}
      actionLabel={actionLabel}
    />
  );
}
