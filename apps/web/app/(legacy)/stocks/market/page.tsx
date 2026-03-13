import { redirect } from "next/navigation";

import { getPreferredLanguage, withSearch } from "@/lib/legacy-routing";
import { stocksMarketPath } from "@/lib/platform-routes";

export default async function LegacyStocksMarketRedirect(props: {
  searchParams: Promise<{ range?: string; indexKeys?: string; summaryDate?: string }>;
}) {
  const lang = await getPreferredLanguage();
  const searchParams = await props.searchParams;
  redirect(withSearch(stocksMarketPath(lang), searchParams));
}
