"use client";

import { useParams } from "next/navigation";

import { NotFoundView } from "@/components/platform/not-found-view";
import { resolveLanguage } from "@/lib/i18n";

export default function LocalizedNotFoundPage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  return <NotFoundView lang={lang} />;
}
