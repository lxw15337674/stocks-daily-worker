"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Check, ChevronDown, LayoutGrid, Newspaper, Settings2, TrendingUp } from "lucide-react";
import { useTranslation, type UseTranslationResponse } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ASSET_REGISTRY, getAssetDescriptor, getLocalizedAssetRegistry, type AssetKey } from "@/lib/assets";
import { MARKET_LANG_COOKIE, resolveLanguage, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  assetArchivePath,
  cryptoAdminPath,
  assetHomePath,
  platformHomePath,
  stocksAdminPath,
  stocksComparePath,
  stocksMarketPath,
  switchLanguagePath
} from "@/lib/platform-routes";

type SiteHeaderProps = {
  lang: Language;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  active: boolean;
};

function resolveAsset(pathname: string): AssetKey | null {
  const segments = pathname.split("/").filter(Boolean);
  const asset = ASSET_REGISTRY.find((item) => item.key === (segments[1] ?? null));
  return asset?.key ?? null;
}

function resolveNavItems(
  lang: Language,
  asset: AssetKey | null,
  pathname: string,
  t: UseTranslationResponse<"common", undefined>["t"]
): NavItem[] {
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
        active: pathname.startsWith(assetArchivePath(lang, "stocks"))
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
        active: pathname.startsWith(stocksAdminPath(lang)) || pathname.startsWith(assetHomePath(lang, "stocks") + "/instrument")
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
      }
    ];
  }

  return [];
}

export function SiteHeader(props: SiteHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLang = resolveLanguage(props.lang);
  const { t } = useTranslation("common");
  const currentAsset = resolveAsset(pathname || `/${currentLang}`);
  const alternateLang = currentLang === "zh" ? "en" : "zh";
  const alternatePath = switchLanguagePath(pathname || `/${currentLang}`, currentLang, alternateLang);
  const alternateHref = searchParams?.toString() ? `${alternatePath}?${searchParams.toString()}` : alternatePath;
  const navItems = resolveNavItems(currentLang, currentAsset, pathname || "", t);
  const activeAsset = getAssetDescriptor(currentAsset, currentLang);
  const localizedAssets = getLocalizedAssetRegistry(currentLang).filter(
    (asset) => asset.enabled && (asset.key === "stocks" || asset.key === "crypto")
  );
  const currentChannel = localizedAssets.find((asset) => asset.key === currentAsset) ?? null;

  useEffect(() => {
    document.cookie = `${MARKET_LANG_COOKIE}=${currentLang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [currentLang]);

  return (
    <div className="site-header-shell">
      <div className="site-header-inner">
        <div className="site-header">
          <div className="site-header-head">
            <div className="site-header-leading">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="channel-switcher-trigger">
                    <span className="channel-switcher-copy">
                      <span className="channel-switcher-label">{t("channelSwitcherLabel")}</span>
                      <span className="channel-switcher-value">{currentChannel?.label ?? t("platformHome")}</span>
                    </span>
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2">
                  <div className="flex flex-col gap-1">
                    {localizedAssets.map((asset) => (
                      <Button
                        key={asset.key}
                        asChild
                        variant="ghost"
                        className={cn(
                          "h-auto min-h-14 justify-start rounded-xl px-3 py-2 text-left",
                          asset.key === currentAsset && "bg-muted text-foreground"
                        )}
                      >
                        <Link href={assetHomePath(currentLang, asset.key)}>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="font-medium text-foreground">{asset.label}</span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">{asset.description}</span>
                          </span>
                          {asset.key === currentAsset ? <Check data-icon="inline-end" /> : null}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Link href={platformHomePath(currentLang)} className="site-header-brandline">
                <span className="site-header-mark" aria-hidden="true" />
                <p className="eyebrow">{t("platformTitle")}</p>
                <span className="site-header-title">{activeAsset?.label ?? t("platformHome")}</span>
                <Badge variant="outline">{t("platformSubtitle")}</Badge>
              </Link>
            </div>
          </div>

          <div className="site-header-controls">
            <NavigationMenu viewport={false} className="site-header-actions-menu !flex-none !w-auto">
              <NavigationMenuList className="site-header-actions !flex-none !w-auto !justify-end">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavigationMenuItem key={item.href}>
                      <NavigationMenuLink asChild className={item.active ? "site-nav-link is-active" : "site-nav-link"}>
                        <Link href={item.href}>
                          <Icon className="h-3.5 w-3.5" />
                          {item.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  );
                })}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className="site-nav-cta">
                    <Link href={alternateHref}>{t("switchLanguage")}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
