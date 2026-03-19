"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bitcoin, Check, ChevronDown, Home, Languages, Menu, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getLocalizedAssetRegistry, type AssetKey } from "@/lib/assets";
import { MARKET_LANG_COOKIE, SUPPORTED_LANGUAGES, resolveLanguage, type Language } from "@/lib/i18n";
import { resolveAsset, resolveNavItems, type SiteHeaderNavItem } from "@/lib/site-header-core";
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

  useEffect(() => {
    document.cookie = `${MARKET_LANG_COOKIE}=${currentLang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [currentLang]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="layout-container flex flex-col gap-2 py-2.5 md:min-h-[var(--site-header-height)] md:flex-row md:flex-nowrap md:items-center md:justify-between">
        <div className="min-w-0 md:max-w-sm md:shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CurrentChannelIcon className="h-3.5 w-3.5" />
                <span className="flex items-center gap-1.5 truncate">
                  <span>
                    {currentLang === "zh" ? "频道" : "Channel"}:
                  </span>
                  <span>
                    {currentChannel?.label ?? t("platformHome")}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} collisionPadding={12}>
              <DropdownMenuLabel>{t("channelSwitcherLabel")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={`/${currentLang}`}>
                    <Home className="h-4 w-4" />
                    <span>{t("platformHome")}</span>
                    {!currentChannel ? <Check className="ml-auto h-4 w-4" /> : null}
                  </Link>
                </DropdownMenuItem>

                {localizedAssets.map((asset) => {
                  const AssetIcon = resolveChannelIcon(asset.key);
                  const active = asset.key === currentAsset;

                  return (
                    <DropdownMenuItem key={asset.key} asChild>
                      <Link href={assetHomePath(currentLang, asset.key)}>
                        <AssetIcon className="h-4 w-4" />
                        <span>{asset.label}</span>
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
                <Button variant="outline" size="sm">
                  <Menu className="h-3.5 w-3.5" />
                  {currentLang === "zh" ? "导航" : "Menu"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} collisionPadding={12}>
                <DropdownMenuLabel>{currentLang === "zh" ? "网站导航" : "Navigation"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
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
                <Button variant="outline" size="sm">
                  <Languages className="h-3.5 w-3.5" />
                  {getLanguageLabel(currentLang)}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} collisionPadding={12}>
                <DropdownMenuLabel>Language</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {languageOptions.map((item) => (
                    <DropdownMenuItem key={item.language} asChild>
                      <Link href={item.href}>
                        <span>{item.label}</span>
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
