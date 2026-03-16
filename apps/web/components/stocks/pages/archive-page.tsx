"use client";

import Link from "next/link";

import { ArchiveTableCard } from "@/components/platform/archive-table-card";
import { RouteSegmentLoading } from "@/components/platform/route-segment-loading";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportList } from "@/lib/api";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

type ArchivePageProps = {
  lang?: Language;
};

export default function ArchivePage(props: ArchivePageProps) {
  const lang = props.lang ?? "zh";
  const t = getFixedT(lang, "common");
  const channelT = getFixedT(lang, "channel", "stocks");
  const { data: reports = [], isLoading } = useReportList(200);

  if (isLoading) {
    return <RouteSegmentLoading title="Loading stocks archive" description={t("loading")} />;
  }

  return (
    <main className="page-shell">
      <ArchiveTableCard
        title={channelT("archiveTitle")}
        description={channelT("archiveDescription")}
        state={reports.length === 0 ? "empty" : "ready"}
        loadingMessage={t("loading")}
        emptyMessage={channelT("emptyArchive")}
        toolbar={
          <Button asChild variant="outline" size="sm">
            <Link href={assetHomePath(lang, "stocks")}>{channelT("backToChannelHome")}</Link>
          </Button>
        }
      >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">{t("reportDate")}</TableHead>
                  <TableHead>{t("generatedAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((item) => (
                  <TableRow key={`${item.reportDateEt}-${item.createdAt}`}>
                    <TableCell>
                      <Link href={`${assetHomePath(lang, "stocks")}?date=${encodeURIComponent(item.reportDateEt)}`} className="font-medium text-primary hover:underline">
                        {lang === "zh" ? item.reportDateEt : new Date(`${item.reportDateEt}T00:00:00Z`).toLocaleDateString("en-US")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </ArchiveTableCard>
    </main>
  );
}
