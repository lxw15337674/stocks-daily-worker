import HomePage from "@/components/stocks/pages/home-page";
import type { Language } from "@/lib/i18n";

export default async function StocksHomePage(props: {
  params: Promise<{ lang: Language }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { lang } = await props.params;
  return <HomePage lang={lang} searchParams={props.searchParams} />;
}
