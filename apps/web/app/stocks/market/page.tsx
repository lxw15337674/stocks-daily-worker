import { redirect } from "next/navigation";

import { getPreferredLanguage } from "@/lib/legacy-routing";
import { stocksMarketPath } from "@/lib/platform-routes";

export default async function LegacyStocksMarketRedirect() {
  const lang = await getPreferredLanguage();
  redirect(stocksMarketPath(lang));
}
