"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { ArchiveTableCard } from "@/components/platform/archive-table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchReportsClient } from "@/lib/crypto/client-api";
import type { ReportListItem } from "@/lib/crypto/types";
import { formatCompactCurrency, formatDate, formatDateTime } from "@/lib/crypto/format";
import type { Language } from "@/lib/i18n";
import { assetReportPath } from "@/lib/platform-routes";

type Props = {
  lang: Language;
};

export function ArchivePageClient(props: Props) {
  const { lang } = props;
  const { t } = useTranslation("common");
  const { t: channelT } = useTranslation("channel", { keyPrefix: "crypto" });
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const readyReports = reports ?? [];

  const loadReports = useEffectEvent(async () => {
    const nextReports = await fetchReportsClient(120);
    startTransition(() => {
      setReports(nextReports);
    });
  });

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <main className="page-shell">
      <ArchiveTableCard
        title={channelT("archiveTitle")}
        description={channelT("archiveDescription")}
        state={reports === null ? "loading" : reports.length === 0 ? "empty" : "ready"}
        loadingMessage={channelT("loading")}
        emptyMessage={channelT("emptyArchive")}
      >
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reportDate")}</TableHead>
                    <TableHead>{t("generatedAt")}</TableHead>
                    <TableHead className="text-right">{t("totalVolume")}</TableHead>
                    <TableHead>{t("breadth")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readyReports.map((report) => (
                    <TableRow key={report.reportDate}>
                      <TableCell>
                        <Link href={assetReportPath(lang, "crypto", report.reportDate)} className="font-medium text-primary hover:underline">
                          {formatDate(report.reportDate, lang)}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDateTime(report.generatedAt, lang)}</TableCell>
                      <TableCell className="text-right">{formatCompactCurrency(report.totalQuoteVolumeUsdt, lang)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t("crypto.breadthSummary", {
                          upCount: report.upCount,
                          downCount: report.downCount,
                          flatCount: report.flatCount
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
      </ArchiveTableCard>
    </main>
  );
}
