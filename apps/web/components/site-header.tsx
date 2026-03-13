"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bitcoin, Check, ChevronDown, Languages, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import { ASSET_REGISTRY, getAssetDescriptor, getLocalizedAssetRegistry, type AssetKey } from "@/lib/assets";
import { MARKET_LANG_COOKIE, SUPPORTED_LANGUAGES, resolveLanguage, type Language } from "@/lib/i18n";
import { resolveAsset, resolveNavItems, type SiteHeaderNavItem } from "@/lib/site-header-core";
import { cn } from "@/lib/utils";
import {
  assetHomePath,
  platformHomePath,
  switchLanguagePath
} from "@/lib/platform-routes";

type SiteHeaderProps = {
  lang: Language;
};

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

function getLanguageLabel(language: Language): string {
  return language === "zh" ? "中文" : "English";
}

export function SiteHeader(props: SiteHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLang = resolveLanguage(props.lang);
  const { t } = useTranslation("common");
  const currentAsset = resolveAsset(pathname || `/${currentLang}`);
  const navItems: SiteHeaderNavItem[] = resolveNavItems(currentLang, currentAsset, pathname || "", t as (key: string) => string);
  const activeAsset = getAssetDescriptor(currentAsset, currentLang);
  const localizedAssets = getLocalizedAssetRegistry(currentLang).filter(
    (asset) => asset.enabled && (asset.key === "stocks" || asset.key === "crypto")
  );
  const languageOptions = SUPPORTED_LANGUAGES.map((language) => {
    const targetPath = switchLanguagePath(pathname || `/${currentLang}`, currentLang, language);
    const href = searchParams?.toString() ? `${targetPath}?${searchParams.toString()}` : targetPath;

    return {
      language,
      href,
      label: getLanguageLabel(language)
    };
  });
  const currentChannel = localizedAssets.find((asset) => asset.key === currentAsset) ?? null;
  const CurrentChannelIcon = resolveChannelIcon(currentChannel?.key ?? currentAsset);
  const currentChannelAccent = resolveChannelAccent(currentChannel?.key ?? currentAsset);
  const currentChannelBadge = currentChannel?.shortLabel ?? activeAsset?.shortLabel ?? t("platformHome");
  const showCurrentChannelBadge =
    currentChannel != null && currentChannel.shortLabel.trim().toLocaleLowerCase() !== currentChannel.label.trim().toLocaleLowerCase();

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
                        {showCurrentChannelBadge ? (
                          <Badge variant="secondary" className="channel-switcher-badge">
                            {currentChannelBadge}
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={10} collisionPadding={12} className="channel-switcher-menu">
                  <DropdownMenuLabel>{t("channelSwitcherLabel")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup className="channel-switcher-menu-group">
                    {localizedAssets.map((asset) => {
                      const AssetIcon = resolveChannelIcon(asset.key);
                      const accent = resolveChannelAccent(asset.key);
                      const showAssetBadge = asset.shortLabel.trim().toLocaleLowerCase() !== asset.label.trim().toLocaleLowerCase();
                      return (
                        <DropdownMenuItem
                          key={asset.key}
                          asChild
                          className={cn(
                            "channel-switcher-menu-item",
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
                                {showAssetBadge ? (
                                  <Badge variant="outline" className="channel-menu-badge">
                                    {asset.shortLabel}
                                  </Badge>
                                ) : null}
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
                  <ThemeToggle lang={currentLang} />
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="site-language-trigger">
                        <Languages className="h-3.5 w-3.5" />
                        {getLanguageLabel(currentLang)}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={10}
                      collisionPadding={12}
                      className="site-language-menu"
                    >
                      <DropdownMenuLabel>Language</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        {languageOptions.map((item) => (
                          <DropdownMenuItem key={item.language} asChild className="site-language-menu-item w-full">
                            <Link href={item.href}>
                              <span className="font-medium text-foreground">{item.label}</span>
                              {item.language === currentLang ? <Check className="ml-auto h-4 w-4" /> : null}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
