export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { CryptoReportDatePageContent } from "@/components/crypto/report-date-page";
import type { Language } from "@/lib/i18n";
import { buildCryptoReportMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language; date: string }>;
}): Promise<Metadata> {
  const { lang, date } = await props.params;
  return buildCryptoReportMetadata(lang, date);
}

export default async function CryptoReportDatePage(props: {
  params: Promise<{ lang: Language; date: string }>;
}) {
  const { lang, date } = await props.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  return <CryptoReportDatePageContent lang={lang} date={date} />;
}
