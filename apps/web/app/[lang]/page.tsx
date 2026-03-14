import type { Metadata } from "next";
import Link from "next/link";

import { AssetAiSummary } from "@/components/platform/asset-ai-summary";
import { HeroPanel } from "@/components/platform/hero-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { fetchHomeBriefs } from "@/lib/api";
import { getLocalizedAssetRegistry } from "@/lib/assets";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";
import { buildPlatformMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildPlatformMetadata(lang);
}

export default async function PlatformHomePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  const t = getFixedT(lang, "common");
  const assets = getLocalizedAssetRegistry(lang);

  // Fetch all asset summaries in a single aggregate API call
  const briefs = await fetchHomeBriefs();
  const getSummary = (key: string) => {
    if (key === "stocks") return briefs?.stocks?.[lang] ?? null;
    if (key === "crypto") return briefs?.crypto?.[lang] ?? null;
    return null;
  };

  return (
    <main className="page-shell space-y-6">
      <HeroPanel eyebrow={t("platformTitle")} title={t("assetHubTitle")} summary={t("assetHubSubtitle")} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {assets.map((asset) => (
          <Card key={asset.key} className="border-border/70 bg-card/90">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">{asset.label}</CardTitle>
                <Badge variant={asset.enabled ? "outline" : "secondary"}>
                  {asset.enabled ? t("openChannel") : t("comingSoon")}
                </Badge>
              </div>
              <CardDescription>{asset.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {asset.enabled ? (
                <div className="space-y-4">
                  <AssetAiSummary summary={getSummary(asset.key)} label={t("aiInsight")} />
                  <Button asChild className="w-full">
                    <Link href={assetHomePath(lang, asset.key)}>{t("openChannel")}</Link>
                  </Button>
                </div>
              ) : (
                <Empty className="border border-dashed border-border/70 bg-background/20 py-6">
                  <EmptyHeader>
                    <EmptyTitle>{t("comingSoon")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
