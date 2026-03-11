"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCoinDetailClient } from "@/lib/client-api";
import type { CoinDetail } from "@/lib/crypto-types";
import { formatCompactCurrency, formatDate, formatDateTime, formatPrice, formatShare, formatSignedPercent } from "@/lib/format";
import { getDictionary, type Language } from "@/lib/i18n";

type Props = {
  lang: Language;
  code: string;
};

export function CoinDetailPageClient(props: Props) {
  const { lang, code } = props;
  const dict = getDictionary(lang);
  const [detail, setDetail] = useState<CoinDetail | null | undefined>(undefined);

  const loadDetail = useEffectEvent(async () => {
    const nextDetail = await fetchCoinDetailClient(code);
    startTransition(() => {
      setDetail(nextDetail);
    });
  });

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (detail === undefined) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>{code.toUpperCase()}</CardTitle>
          </CardHeader>
          <CardContent>{lang === "zh" ? "加载中..." : "Loading..."}</CardContent>
        </Card>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="page-shell">
        <Card>
          <CardHeader>
            <CardTitle>{code.toUpperCase()}</CardTitle>
          </CardHeader>
          <CardContent>{dict.noData}</CardContent>
        </Card>
      </main>
    );
  }

  const name = lang === "zh" ? detail.coin.nameZh : detail.coin.nameEn;
  const corePosition = lang === "zh" ? detail.coin.corePositionZh : detail.coin.corePositionEn;

  return (
    <main className="page-shell space-y-6">
      <Card className="hero-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="eyebrow">{detail.coin.code}</p>
              <CardTitle className="mt-2 text-3xl">{name}</CardTitle>
              <p className="hero-summary">{corePosition}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">#{detail.coin.rank}</Badge>
              <Badge variant="outline">{dict.annualShare}: {formatShare(detail.coin.annualTradeSharePct)}</Badge>
              <Badge variant="outline">{dict.annualVolume}: {formatCompactCurrency(detail.coin.annualQuoteVolumeUsdt, lang)}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.latestSnapshot}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {detail.latestSnapshot ? formatPrice(detail.latestSnapshot.priceUsdt, lang) : dict.noData}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.tableChange24h}</CardTitle>
          </CardHeader>
          <CardContent className={`text-2xl font-semibold ${detail.latestSnapshot && detail.latestSnapshot.change24hPct > 0 ? "text-red-400" : detail.latestSnapshot && detail.latestSnapshot.change24hPct < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
            {detail.latestSnapshot ? formatSignedPercent(detail.latestSnapshot.change24hPct) : dict.noData}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.tableVolume24h}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {detail.latestSnapshot ? formatCompactCurrency(detail.latestSnapshot.quoteVolume24hUsdt, lang) : dict.noData}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{dict.generatedAt}</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-muted-foreground">
            {detail.latestSnapshot ? formatDateTime(detail.latestSnapshot.closeTime, lang) : dict.noData}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{dict.coinProfile}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">{dict.tableCode}:</span> {detail.coin.code}</p>
          <p><span className="font-medium text-foreground">Pair:</span> {detail.coin.pair}</p>
          <p><span className="font-medium text-foreground">{dict.corePosition}:</span> {corePosition}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{dict.recentHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.history.length === 0 ? (
            <p className="empty">{dict.noData}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.reportDate}</TableHead>
                    <TableHead className="text-right">{dict.tablePrice}</TableHead>
                    <TableHead className="text-right">{dict.tableChange24h}</TableHead>
                    <TableHead className="text-right">{dict.tableVolume24h}</TableHead>
                    <TableHead className="text-right">{dict.tableShare}</TableHead>
                    <TableHead>{dict.generatedAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.history.map((item, index) => (
                    <TableRow key={`${item.reportDate ?? item.closeTime}-${index}`}>
                      <TableCell>{item.reportDate ? formatDate(item.reportDate, lang) : "-"}</TableCell>
                      <TableCell className="text-right">{formatPrice(item.priceUsdt, lang)}</TableCell>
                      <TableCell className={`text-right font-semibold ${item.change24hPct > 0 ? "text-red-400" : item.change24hPct < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {formatSignedPercent(item.change24hPct)}
                      </TableCell>
                      <TableCell className="text-right">{formatCompactCurrency(item.quoteVolume24hUsdt, lang)}</TableCell>
                      <TableCell className="text-right">{formatShare(item.tradeSharePct)}</TableCell>
                      <TableCell>{formatDateTime(item.closeTime, lang)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
