import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPreferredLanguage } from "@/lib/legacy-routing";
import { getFixedT } from "@/lib/i18n";

export default async function NotFoundPage() {
  const lang = await getPreferredLanguage();
  const t = getFixedT(lang, "common", "notFound");

  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/">{t("backHome")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/archive">{t("openArchive")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/stocks">{t("openAdmin")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
