"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetArchivePath, platformHomePath, stocksAdminPath } from "@/lib/platform-routes";
import { resolveLanguage } from "@/lib/i18n";

export default function LocalizedNotFoundPage() {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  const { t } = useTranslation("common", { keyPrefix: "notFound" });

  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href={platformHomePath(lang)}>{t("backHome")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={assetArchivePath(lang, "stocks")}>{t("openArchive")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={stocksAdminPath(lang)}>{t("openAdmin")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
