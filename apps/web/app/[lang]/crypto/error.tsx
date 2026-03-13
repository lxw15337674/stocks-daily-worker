"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveLanguage } from "@/lib/i18n";
import { assetHomePath } from "@/lib/platform-routes";

export default function CryptoError(props: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLanguage(params?.lang);
  const { t } = useTranslation("common");

  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>{t("assets.crypto.label")}</CardTitle>
          <CardDescription>Something went wrong while rendering the crypto segment.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => props.reset()}>
            Retry
          </Button>
          <Button asChild variant="outline">
            <Link href={assetHomePath(lang, "crypto")}>{t("assets.crypto.label")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
