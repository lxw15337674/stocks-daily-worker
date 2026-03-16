"use client";

import { useParams } from "next/navigation";

import StatusPage from "@/components/platform/pages/status-page";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { resolveLanguage } from "@/lib/i18n";
import { usePlatformStatusPageData } from "@/lib/platform-status";

export default function LocalizedStatusPage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  const { data, isLoading } = usePlatformStatusPageData();

  if (!data || isLoading) {
    return <RouteSegmentLoading title="Loading status" description="Preparing scheduler and freshness data." />;
  }

  return <StatusPage lang={lang} data={data} />;
}

