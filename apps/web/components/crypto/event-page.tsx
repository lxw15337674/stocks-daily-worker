import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusCard } from "@/components/platform/status-card";
import { getChangeTextClass } from "@/lib/change-color";
import { fetchCoins, fetchNewsEventDetail } from "@/lib/crypto/api";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/crypto/format";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetArchivePath, assetInstrumentPath } from "@/lib/platform-routes";

type CryptoEventPageProps = {
  lang: Language;
  clusterId: number;
};

function renderStance(value: "bullish" | "bearish" | "neutral", t: (key: string) => string): string {
  if (value === "bullish") {
    return t("crypto.stanceBullish");
  }
  if (value === "bearish") {
    return t("crypto.stanceBearish");
  }
  return t("crypto.stanceNeutral");
}

export async function CryptoEventPageContent(props: CryptoEventPageProps) {
  const { clusterId, lang } = props;
  const t = getFixedT(lang, "common");

  const [detail, coins] = await Promise.all([fetchNewsEventDetail(clusterId), fetchCoins()]);

  if (!detail) {
    return <StatusCard title={t("crypto.eventDetailTitle")} body={t("crypto.eventNotFound")} />;
  }

  const coinByCode = new Map(coins.map((coin) => [coin.code, coin]));

  return (
    <main className="page-shell space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{detail.label}</CardTitle>
            <Badge variant="secondary">{renderStance(detail.stance, t)}</Badge>
            <Badge variant="outline">{t("crypto.clusterImpact", { impact: detail.marketImpact })}</Badge>
            <Badge variant="outline">{t("crypto.signalLabel")}: {detail.importanceScore}</Badge>
            {detail.associationScore !== null ? (
              <Badge variant="secondary">{t("crypto.associationScoreLabel")}: {detail.associationScore}</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <p>{t("crypto.eventReportDateLabel")}: {formatDate(detail.reportDate, lang)}</p>
            <p>{t("crypto.clusterSources", { count: detail.sourceCount })}</p>
            <p>{t("crypto.eventRepresentativeLabel")}: {detail.representative.source}</p>
          </div>

          {detail.relatedCoins.length > 0 ? (
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t("crypto.eventRelatedCoinsLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {detail.relatedCoins.map((coinCode) => (
                  <Badge key={`${detail.clusterId}-${coinCode}`} variant="outline">
                    {coinCode}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {detail.topics.length > 0 ? (
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t("crypto.eventTopicsLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {detail.topics.map((topic) => (
                  <Badge key={`${detail.clusterId}-${topic}`} variant="secondary">
                    {topic}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <p className="text-sm text-muted-foreground">
            <Link href={assetArchivePath(lang, "crypto")} className="text-primary hover:underline">
              {t("crypto.eventBackLabel")}
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("crypto.eventCoinContextTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.coinSnapshots.length === 0 ? (
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{t("noData")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[780px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tableCode")}</TableHead>
                    <TableHead>{t("tableName")}</TableHead>
                    <TableHead className="text-right">{t("tablePrice")}</TableHead>
                    <TableHead className="text-right">{t("tableChange24h")}</TableHead>
                    <TableHead className="text-right">{t("tableVolume24h")}</TableHead>
                    <TableHead className="text-right">{t("tableShare")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.coinSnapshots.map((item) => {
                    const coin = coinByCode.get(item.code);
                    return (
                      <TableRow key={`${detail.clusterId}-${item.code}`}>
                        <TableCell>{item.code}</TableCell>
                        <TableCell>
                          <Link href={assetInstrumentPath(lang, "crypto", item.code)} className="font-medium text-primary hover:underline">
                            {coin ? (lang === "zh" ? coin.nameZh : coin.nameEn) : item.code}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(item.priceUsdt, lang)}</TableCell>
                        <TableCell className={`text-right font-semibold ${getChangeTextClass(lang, item.change24hPct)}`}>
                          {formatSignedPercent(item.change24hPct)}
                        </TableCell>
                        <TableCell className="text-right">{formatCompactCurrency(item.quoteVolume24hUsdt, lang)}</TableCell>
                        <TableCell className="text-right">{formatShare(item.tradeSharePct)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("crypto.eventCoverageTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.coverage.length === 0 ? (
            <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
              <EmptyHeader>
                <EmptyTitle>{t("noData")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {detail.coverage.map((item) => (
                <article key={`${detail.clusterId}-${item.id}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.isRepresentative ? <Badge>{t("crypto.eventRepresentativeLabel")}</Badge> : null}
                    <Badge variant="outline">{renderStance(item.stance, t)}</Badge>
                    <Badge variant="secondary">{item.eventType}</Badge>
                    <Badge variant="outline">{t("crypto.signalLabel")}: {item.signalScore}</Badge>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                  >
                    {item.title}
                  </a>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.source} · {formatDateTime(item.publishedAt, lang)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground/90">
                    {lang === "zh" ? item.summaryZh : item.summaryEn}
                  </p>
                  {item.relatedCoins.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.relatedCoins.map((coinCode) => (
                        <Badge key={`${item.id}-${coinCode}`} variant="outline">
                          {coinCode}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
