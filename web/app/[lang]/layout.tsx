import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { isLanguage } from "@/lib/i18n";

export default async function LanguageLayout(props: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  if (!isLanguage(lang)) {
    notFound();
  }

  return (
    <>
      <SiteHeader lang={lang} />
      {props.children}
    </>
  );
}
