"use client";

import { useParams } from "next/navigation";

import AdminPage from "@/components/stocks/pages/admin-page";
import { resolveLanguage } from "@/lib/i18n";

export default function LocalizedStocksAdminPage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  return <AdminPage lang={lang} />;
}

