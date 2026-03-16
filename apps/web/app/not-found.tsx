"use client";

import { usePathname } from "next/navigation";

import { NotFoundView } from "@/components/platform/not-found-view";
import { resolveLanguage } from "@/lib/i18n";

export default function NotFoundPage() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const lang = resolveLanguage(firstSegment);
  return <NotFoundView lang={lang} />;
}

