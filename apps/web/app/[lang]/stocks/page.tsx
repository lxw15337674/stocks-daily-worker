"use client";

import { useParams, useSearchParams } from "next/navigation";

import HomePage from "@/components/stocks/pages/home-page";
import { resolveLanguage } from "@/lib/i18n";

export default function StocksHomePage() {
  const params = useParams<{ lang?: string }>();
  const searchParams = useSearchParams();
  const lang = resolveLanguage(params?.lang);

  return <HomePage lang={lang} date={searchParams.get("date") ?? undefined} />;
}

