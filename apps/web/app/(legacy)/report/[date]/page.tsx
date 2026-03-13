import { redirect } from "next/navigation";

import { getPreferredLanguage } from "@/lib/legacy-routing";
import { assetReportPath } from "@/lib/platform-routes";

export default async function LegacyReportRedirect(props: {
  params: Promise<{ date: string }>;
}) {
  const lang = await getPreferredLanguage();
  const { date } = await props.params;
  redirect(assetReportPath(lang, "stocks", date));
}
