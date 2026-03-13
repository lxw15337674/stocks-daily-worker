import { redirect } from "next/navigation";

import { getPreferredLanguage } from "@/lib/legacy-routing";
import { stocksAdminPath } from "@/lib/platform-routes";

export default async function LegacyStocksAdminRedirect() {
  const lang = await getPreferredLanguage();
  redirect(stocksAdminPath(lang));
}
