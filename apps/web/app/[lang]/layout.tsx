import { notFound } from "next/navigation";

import { I18nProvider } from "@/components/providers/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { isLanguage } from "@/lib/i18n";

export default async function LocalizedLayout(props: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;

  if (!isLanguage(lang)) {
    notFound();
  }

  return (
    <I18nProvider lang={lang}>
      <SiteHeader lang={lang} />
      {props.children}
    </I18nProvider>
  );
}
