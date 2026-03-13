import { redirect } from "next/navigation";

import { getPreferredLanguage } from "@/lib/legacy-routing";
import { assetArchivePath } from "@/lib/platform-routes";

export default async function LegacyArchiveRedirect() {
  const lang = await getPreferredLanguage();
  redirect(assetArchivePath(lang, "stocks"));
}
