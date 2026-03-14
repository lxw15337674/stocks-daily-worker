"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bitcoin, Check, ChevronDown, Home, Languages, Menu, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getAssetDescriptor, getLocalizedAssetRegistry, type AssetKey } from "@/lib/assets";
import { MARKET_LANG_COOKIE, SUPPORTED_LANGUAGES, resolveLanguage, type Language } from "@/lib/i18n";
import { resolveAsset, resolveNavItems, type SiteHeaderNavItem } from "@/lib/site-header-core";
import { cn } from "@/lib/utils";
import {
  assetHomePath,
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="layout-container flex flex-col gap-2 py-2.5 md:flex-row md:flex-nowrap md:items-center md:justify-between">
        <div className="min-w-0 md:max-w-sm md:shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border-border/70 bg-background/45 px-2.5 text-sm font-medium text-foreground transition hover:bg-muted/55",
                  currentChannelAccent.trigger
                )}
              >
                <CurrentChannelIcon className="h-3.5 w-3.5" />
                <span className="flex items-center gap-1.5 truncate">
                  <span className="text-muted-foreground/70 font-normal">
                    {currentLang === "zh" ? "频道" : "Channel"}:
                  </span>
                  <span className="font-semibold">
                    {currentChannel?.label ?? t("platformHome")}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={10}
              collisionPadding={12}
              className="min-w-[16rem] rounded-xl border border-border/90 bg-popover/95 p-1.5 shadow-xl backdrop-blur"
            >
              <DropdownMenuLabel>{t("channelSwitcherLabel")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup className="space-y-1">
                <DropdownMenuItem
                  asChild
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-2 py-2",
                    !currentChannel && "bg-accent/10 text-foreground"
                  )}
                >
                  <Link href={`/${currentLang}`} className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                      <Home className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium">{t("platformHome")}</span>
                    {!currentChannel ? <Check className="ml-auto h-4 w-4" /> : null}
                  </Link>
                </DropdownMenuItem>

                {localizedAssets.map((asset) => {
                  const AssetIcon = resolveChannelIcon(asset.key);
                  const accent = resolveChannelAccent(asset.key);
                  const active = asset.key === currentAsset;

                  return (
                    <DropdownMenuItem
                      key={asset.key}
                      asChild
                      className={cn(
                        "w-full cursor-pointer rounded-lg px-2 py-2",
                        active && cn(accent.itemActive, "bg-accent/10 text-foreground")
                      )}
                    >
                      <Link href={assetHomePath(currentLang, asset.key)} className="flex items-center gap-2.5">
                        <span className={cn("flex size-7 items-center justify-center rounded-md border", accent.iconShell)}>
                          <AssetIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{asset.label}</span>
                        </div>
                        {active ? <Check className="ml-auto h-4 w-4" /> : null}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-w-0 flex-1 justify-end">
          <nav className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:flex-nowrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border-border/70 bg-background/45 px-2.5 text-sm font-medium text-foreground transition hover:bg-muted/55"
                >
                  <Menu className="h-3.5 w-3.5" />
                  {currentLang === "zh" ? "导航" : "Menu"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                collisionPadding={12}
                className="min-w-[12rem] rounded-xl border border-border/90 bg-popover/95 p-1.5 shadow-xl backdrop-blur"
              >
                <DropdownMenuLabel>{currentLang === "zh" ? "网站导航" : "Navigation"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href} asChild className="w-full rounded-lg px-2 py-2">
                        <Link href={item.href} className={cn("flex items-center gap-2", item.active && "bg-accent/10 text-foreground")}>
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{item.label}</span>
                          {item.active ? <Check className="ml-auto h-4 w-4" /> : null}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle lang={currentLang} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border-border/70 bg-background/45 px-2.5 text-sm font-medium text-foreground transition hover:bg-muted/55"
                >
                  <Languages className="h-3.5 w-3.5" />
                  {getLanguageLabel(currentLang)}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                collisionPadding={12}
                className="min-w-[12rem] rounded-xl border border-border/90 bg-popover/95 p-1.5 shadow-xl backdrop-blur"
              >
                <DropdownMenuLabel>Language</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {languageOptions.map((item) => (
                    <DropdownMenuItem key={item.language} asChild className="w-full rounded-lg px-2 py-2">
                      <Link href={item.href}>
                        <span className="font-medium text-foreground">{item.label}</span>
                        {item.language === currentLang ? <Check className="ml-auto h-4 w-4" /> : null}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
}
