import { redirect } from "next/navigation";

import { getPreferredLanguage, withSearch } from "@/lib/legacy-routing";
import { assetInstrumentPath } from "@/lib/platform-routes";

export default async function LegacyStockInstrumentRedirect(props: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const lang = await getPreferredLanguage();
  const { symbol } = await props.params;
  const searchParams = await props.searchParams;
  redirect(withSearch(assetInstrumentPath(lang, "stocks", symbol), searchParams));
}
