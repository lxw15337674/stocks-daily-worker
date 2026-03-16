"use client";

import { useParams } from "next/navigation";

import CryptoAdminPage from "@/components/crypto/admin-page";
import { resolveLanguage } from "@/lib/i18n";

export default function LocalizedCryptoAdminPage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  return <CryptoAdminPage lang={lang} />;
}

