import { Activity, ArrowLeftRight, LayoutGrid, Newspaper, Settings2, TrendingUp, type LucideIcon } from "lucide-react";

import { ASSET_REGISTRY, getLocalizedAssetRegistry, type AssetKey } from "@/lib/assets";
import type { Language } from "@/lib/i18n";
import {
  assetArchivePath,
  assetHomePath,
  cryptoAdminPath,
  platformStatusPath,
  stocksAdminPath,
  stocksComparePath,
  stocksMarketPath
} from "@/lib/platform-routes";

export type SiteHeaderNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
};

export function resolveAsset(pathname: string): AssetKey | null {
  const segments = pathname.split("/").filter(Boolean);
  const asset = ASSET_REGISTRY.find((item) => item.key === (segments[1] ?? null));
  return asset?.key ?? null;
}

export function resolveNavItems(
  lang: Language,
  asset: AssetKey | null,
  pathname: string,
  t: (key: string) => string
): SiteHeaderNavItem[] {
  const labels = getLocalizedAssetRegistry(lang).reduce<Record<AssetKey, string>>(
    (next, item) => ({ ...next, [item.key]: item.label }),
    {} as Record<AssetKey, string>
  );

  if (asset === "stocks") {
    return [
      {
        href: assetHomePath(lang, "stocks"),
        label: labels.stocks,
        icon: LayoutGrid,
        active: pathname === assetHomePath(lang, "stocks")
      },
      {
        href: assetArchivePath(lang, "stocks"),
        label: t("stocksArchive"),
        icon: Newspaper,
        active:
          pathname.startsWith(assetArchivePath(lang, "stocks")) ||
          pathname.startsWith(assetHomePath(lang, "stocks") + "/report") ||
          pathname.startsWith(assetHomePath(lang, "stocks") + "/instrument")
      },
      {
        href: stocksComparePath(lang),
        label: t("stocksCompare"),
        icon: ArrowLeftRight,
        active: pathname.startsWith(stocksComparePath(lang))
      },
      {
        href: stocksMarketPath(lang),
        label: t("stocksMarket"),
        icon: TrendingUp,
        active: pathname.startsWith(stocksMarketPath(lang))
      },
      {
        href: stocksAdminPath(lang),
        label: t("stocksAdmin"),
        icon: Settings2,
        active: pathname.startsWith(stocksAdminPath(lang))
      },
      {
        href: platformStatusPath(lang),
        label: t("platformStatus"),
        icon: Activity,
        active: pathname.startsWith(platformStatusPath(lang))
      }
    ];
  }

  if (asset === "crypto") {
    return [
      {
        href: assetHomePath(lang, "crypto"),
        label: labels.crypto,
        icon: LayoutGrid,
        active: pathname === assetHomePath(lang, "crypto")
      },
      {
        href: assetArchivePath(lang, "crypto"),
        label: t("cryptoArchive"),
        icon: Newspaper,
        active:
          pathname.startsWith(assetArchivePath(lang, "crypto")) ||
          pathname.startsWith(assetHomePath(lang, "crypto") + "/report") ||
          pathname.startsWith(assetHomePath(lang, "crypto") + "/instrument") ||
          pathname.startsWith(assetHomePath(lang, "crypto") + "/event")
      },
      {
        href: cryptoAdminPath(lang),
        label: t("cryptoAdmin"),
        icon: Settings2,
        active: pathname.startsWith(cryptoAdminPath(lang))
      },
      {
        href: platformStatusPath(lang),
        label: t("platformStatus"),
        icon: Activity,
        active: pathname.startsWith(platformStatusPath(lang))
      }
    ];
  }

  if (pathname.startsWith(platformStatusPath(lang))) {
    return [
      {
        href: platformStatusPath(lang),
        label: t("platformStatus"),
        icon: Activity,
        active: true
      }
    ];
  }

  return [];
}
