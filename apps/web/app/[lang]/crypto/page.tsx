"use client";

import { useParams } from "next/navigation";

import { CryptoHomePageContent } from "@/components/crypto/home-page";
import { resolveLanguage } from "@/lib/i18n";

export default function CryptoHomePage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  return <CryptoHomePageContent lang={lang} />;
}

