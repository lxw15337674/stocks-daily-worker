import type { AssetKey } from "@/lib/assets";
import type { Language } from "@/lib/i18n";

export function platformHomePath(lang: Language): string {
  return `/${lang}`;
}

export function platformStatusPath(lang: Language): string {
  return `${platformHomePath(lang)}/status`;
}

export function assetHomePath(lang: Language, asset: AssetKey): string {
  return `/${lang}/${asset}`;
}

export function assetArchivePath(lang: Language, asset: AssetKey): string {
  return `${assetHomePath(lang, asset)}/archive`;
}

export function stocksComparePath(lang: Language): string {
  return `${assetHomePath(lang, "stocks")}/compare`;
}

export function stocksMarketPath(lang: Language): string {
  return `${assetHomePath(lang, "stocks")}/market`;
}

export function stocksAdminPath(lang: Language): string {
  return `${assetHomePath(lang, "stocks")}/admin`;
}

export function cryptoAdminPath(lang: Language): string {
  return `${assetHomePath(lang, "crypto")}/admin`;
}

export function assetReportPath(lang: Language, asset: Extract<AssetKey, "stocks" | "crypto">, id: string): string {
  return `${assetHomePath(lang, asset)}/report/${encodeURIComponent(id)}`;
}

export function assetInstrumentPath(lang: Language, asset: Extract<AssetKey, "stocks" | "crypto">, id: string): string {
  return `${assetHomePath(lang, asset)}/instrument/${encodeURIComponent(id)}`;
}

export function assetEventPath(lang: Language, clusterId: number): string {
  return `${assetHomePath(lang, "crypto")}/event/${encodeURIComponent(String(clusterId))}`;
}

export function switchLanguagePath(pathname: string, current: Language, target: Language): string {
  if (pathname === `/${current}` || pathname.startsWith(`/${current}/`)) {
    return pathname.replace(`/${current}`, `/${target}`);
  }

  return platformHomePath(target);
}
