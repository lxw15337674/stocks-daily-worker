import { redirect } from "next/navigation";

import { getPreferredLanguage, withSearch } from "@/lib/legacy-routing";
import { stocksComparePath } from "@/lib/platform-routes";

export default async function LegacyCompareRedirect(props: {
  searchParams: Promise<{ date?: string; compareDate?: string }>;
}) {
  const lang = await getPreferredLanguage();
  const searchParams = await props.searchParams;
  redirect(withSearch(stocksComparePath(lang), searchParams));
}
