import { cookies } from "next/headers";

import { MARKET_LANG_COOKIE, resolveLanguage, type Language } from "@/lib/i18n";

export async function getPreferredLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  return resolveLanguage(cookieStore.get(MARKET_LANG_COOKIE)?.value);
}

export function withSearch(basePath: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim().length > 0) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
