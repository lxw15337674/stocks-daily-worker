import { redirect } from "next/navigation";

import { getPreferredLanguage, withSearch } from "@/lib/legacy-routing";
import { assetHomePath, platformHomePath } from "@/lib/platform-routes";

export default async function RootRedirectPage(props: {
  searchParams: Promise<{ date?: string }>;
}) {
  const lang = await getPreferredLanguage();
  const searchParams = await props.searchParams;

  if (searchParams.date) {
    redirect(withSearch(assetHomePath(lang, "stocks"), { date: searchParams.date }));
  }

  redirect(platformHomePath(lang));
}
