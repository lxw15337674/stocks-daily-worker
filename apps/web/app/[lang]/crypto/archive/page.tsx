"use client";

import { useParams } from "next/navigation";

import { CryptoArchivePageContent } from "@/components/crypto/archive-page";
import { resolveLanguage } from "@/lib/i18n";

export default function CryptoArchivePage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  return <CryptoArchivePageContent lang={lang} />;
}

