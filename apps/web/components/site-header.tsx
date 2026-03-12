"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Bitcoin, Check, ChevronDown, LayoutGrid, Newspaper, Settings2, TrendingUp } from "lucide-react";
import { useTranslation, type UseTranslationResponse } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
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

function resolveChannelIcon(asset: AssetKey | null): typeof TrendingUp {
  if (asset === "crypto") {
    return Bitcoin;
  }
  return TrendingUp;
}

function resolveChannelAccent(asset: AssetKey | null): {
  trigger: string;
  iconShell: string;
  itemActive: string;
} {
  if (asset === "crypto") {
    return {
      trigger: "border-secondary/80 bg-secondary/35",
      iconShell: "border-secondary/80 bg-secondary text-secondary-foreground",
      itemActive: "bg-secondary/50"
    };
  }

  return {
    trigger: "border-primary/30 bg-primary/5",
    iconShell: "border-primary/20 bg-primary/10 text-primary",
    itemActive: "bg-primary/5"
  };
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
  const CurrentChannelIcon = resolveChannelIcon(currentChannel?.key ?? currentAsset);
  const currentChannelAccent = resolveChannelAccent(currentChannel?.key ?? currentAsset);
  const currentChannelBadge = currentChannel?.shortLabel ?? activeAsset?.shortLabel ?? t("platformHome");

  useEffect(() => {
    document.cookie = `${MARKET_LANG_COOKIE}=${currentLang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [currentLang]);

  return (
    <div className="site-header-shell">
      <div className="site-header-inner">
        <div className="site-header">
          <div className="site-header-head">
            <div className="site-header-leading">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("channel-switcher-trigger", currentChannelAccent.trigger)}>
                    <span className={cn("flex size-8 items-center justify-center rounded-lg border", currentChannelAccent.iconShell)}>
                      <CurrentChannelIcon />
                    </span>
                    <span className="channel-switcher-copy">
                      <span className="channel-switcher-label">{t("channelSwitcherLabel")}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="channel-switcher-value">{currentChannel?.label ?? t("platformHome")}</span>
                        <Badge variant="secondary" className="channel-switcher-badge">
                          {currentChannelBadge}
                        </Badge>
                      </span>
                    </span>
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-2">
                  <DropdownMenuLabel>{t("channelSwitcherLabel")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {localizedAssets.map((asset) => {
                      const AssetIcon = resolveChannelIcon(asset.key);
                      const accent = resolveChannelAccent(asset.key);
                      return (
                        <DropdownMenuItem
                          key={asset.key}
                          asChild
                          className={cn(
                            "h-auto min-h-14 rounded-xl px-3 py-2",
                            asset.key === currentAsset && cn(accent.itemActive, "text-foreground")
                          )}
                        >
                          <Link href={assetHomePath(currentLang, asset.key)}>
                            <span className={cn("flex size-9 items-center justify-center rounded-lg border", accent.iconShell)}>
                              <AssetIcon />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-medium text-foreground">{asset.label}</span>
                                <Badge variant="outline" className="channel-menu-badge">
                                  {asset.shortLabel}
                                </Badge>
                              </span>
                              <span className="line-clamp-2 text-xs text-muted-foreground">{asset.description}</span>
                            </span>
                            {asset.key === currentAsset ? <Check data-icon="inline-end" /> : null}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link href={platformHomePath(currentLang)} className="site-header-brandline">
                <span className="site-header-mark" aria-hidden="true" />
                <p className="eyebrow">{t("platformTitle")}</p>
                <span className="site-header-title">{activeAsset?.label ?? t("platformHome")}</span>
                <Badge variant="outline" className="site-header-subtitle-badge">
                  {t("platformSubtitle")}
                </Badge>
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
