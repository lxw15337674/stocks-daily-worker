"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetArchivePath, platformHomePath, stocksAdminPath } from "@/lib/platform-routes";
import { type Language } from "@/lib/i18n";

type NotFoundViewProps = {
  lang: Language;
};

export function NotFoundView(props: NotFoundViewProps) {
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
            <Link href={platformHomePath(props.lang)}>{t("backHome")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={assetArchivePath(props.lang, "stocks")}>{t("openArchive")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={stocksAdminPath(props.lang)}>{t("openAdmin")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

