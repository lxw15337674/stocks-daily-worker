"use client";

import type { Language } from "@/lib/i18n";
import { useHomeArchivedMarketPulse } from "@/lib/stocks-market";
import { MarketStatusGrid } from "./market-status-grid";

type HomeMarketPulseArchiveProps = {
  lang: Language;
  date: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

export function HomeMarketPulseArchive(props: HomeMarketPulseArchiveProps) {
  const { actionHref, actionLabel, date, description, lang, title } = props;
  const { data } = useHomeArchivedMarketPulse(date);

  return (
    <MarketStatusGrid
      lang={lang}
      latest={data?.latest ?? null}
      summaries={data?.summaries ?? []}
      variant="archive"
      title={title}
      description={description}
      actionHref={actionHref}
      actionLabel={actionLabel}
    />
  );
}
