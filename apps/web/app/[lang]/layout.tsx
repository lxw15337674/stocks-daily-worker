"use client";

import { useParams } from "next/navigation";

import { I18nProvider } from "@/components/providers/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { NotFoundView } from "@/components/platform/not-found-view";
import { isLanguage, resolveLanguage } from "@/lib/i18n";

export default function LocalizedLayout(props: { children: React.ReactNode }) {
  const params = useParams<{ lang?: string }>();
  const rawLang = params?.lang ?? "";
  const lang = resolveLanguage(rawLang);

  if (!isLanguage(rawLang)) {
    return (
      <I18nProvider lang={lang}>
        <NotFoundView lang={lang} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider lang={lang}>
      <SiteHeader lang={lang} />
      {props.children}
    </I18nProvider>
  );
}

