import Link from "next/link";

import { HeroPanel } from "@/components/platform/hero-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocalizedAssetRegistry } from "@/lib/assets";
import { getFixedT, type Language } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

export default async function PlatformHomePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  const t = getFixedT(lang, "common");
  const assets = getLocalizedAssetRegistry(lang);

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
                <Button asChild className="w-full">
                  <Link href={assetHomePath(lang, asset.key)}>{t("openChannel")}</Link>
                </Button>
              ) : (
                <p className="empty">{t("comingSoon")}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
