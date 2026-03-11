"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import type { Language } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";

type SiteHeaderProps = {
  lang: Language;
};

function switchLanguage(pathname: string, current: Language, target: Language): string {
  if (pathname === `/${current}` || pathname.startsWith(`/${current}/`)) {
    return pathname.replace(`/${current}`, `/${target}`);
  }
  return `/${target}`;
}

export function SiteHeader(props: SiteHeaderProps) {
  const pathname = usePathname();
  const dict = getDictionary(props.lang);
  const alternateLanguage = props.lang === "zh" ? "en" : "zh";
  const alternateHref = switchLanguage(pathname || `/${props.lang}`, props.lang, alternateLanguage);

  return (
    <div className="site-header-shell">
      <div className="site-header-inner">
        <div className="site-header">
          <Link href={`/${props.lang}`} className="site-header-head">
            <div className="site-header-brandline">
              <span className="site-header-mark" aria-hidden="true" />
              <p className="eyebrow">Crypto Daily</p>
              <span className="site-header-title">{dict.siteTitle}</span>
              <Badge variant="outline">UTC</Badge>
            </div>
            <p className="meta mt-1">{dict.siteSubtitle}</p>
          </Link>

          <div className="site-header-controls">
            <NavigationMenu viewport={false} className="site-header-actions-menu !flex-none !w-auto">
              <NavigationMenuList className="site-header-actions !flex-none !w-auto !justify-end">
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className="site-nav-link">
                    <Link href={`/${props.lang}`}>{dict.navHome}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className="site-nav-link">
                    <Link href={`/${props.lang}/archive`}>{dict.navArchive}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className="site-nav-link">
                    <Link href={`/${props.lang}`}>{dict.navLatest}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className="site-nav-cta">
                    <Link href={alternateHref}>{dict.languageLabel}</Link>
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
