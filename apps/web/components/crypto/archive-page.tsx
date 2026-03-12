import Link from "next/link";

import { ArchiveTableCard } from "@/components/platform/archive-table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchReports } from "@/lib/crypto/api";
import { formatCompactCurrency, formatDate, formatDateTime } from "@/lib/crypto/format";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetReportPath } from "@/lib/platform-routes";

type CryptoArchivePageProps = {
  lang: Language;
};

export async function CryptoArchivePageContent(props: CryptoArchivePageProps) {
  const { lang } = props;
  const t = getFixedT(lang, "common");
  const channelT = getFixedT(lang, "channel", "crypto");
  const reports = await fetchReports(120);

  return (
    <main className="page-shell">
      <ArchiveTableCard
        title={channelT("archiveTitle")}
        description={channelT("archiveDescription")}
        state={reports.length === 0 ? "empty" : "ready"}
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
              {reports.map((report) => (
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
