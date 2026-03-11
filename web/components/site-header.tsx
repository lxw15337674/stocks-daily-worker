"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Newspaper, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";

type HeaderContext = {
  title: string;
  meta: string | null;
  showTradingBadge: boolean;
};

function formatCompactDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.replace(/-/g, "/");
}

function resolveHeaderContext(pathname: string, searchParams: URLSearchParams): HeaderContext {
  const date = searchParams.get("date");
  const compareDate = searchParams.get("compareDate");

  if (pathname === "/") {
    return {
      title: date ?? "最新日报",
      meta: date ? `当前查看：${formatCompactDate(date)}` : "当前查看：最新日报",
      showTradingBadge: true
    };
  }

  if (pathname === "/compare") {
    const current = formatCompactDate(date);
    const previous = formatCompactDate(compareDate);
    return {
      title: "日报对比",
      meta: current && previous ? `${current} vs ${previous}` : null,
      showTradingBadge: false
    };
  }

  if (pathname === "/archive") {
    return {
      title: "历史日报",
      meta: "按美东交易日查看归档",
      showTradingBadge: false
    };
  }

  if (pathname === "/stocks") {
    return {
      title: "股票管理",
      meta: "维护日报股票池",
      showTradingBadge: false
    };
  }

  if (pathname.startsWith("/stock/")) {
    const symbol = pathname.split("/").filter(Boolean).at(-1)?.toUpperCase() ?? "股票详情";
    return {
      title: "股票详情",
      meta: symbol,
      showTradingBadge: false
    };
  }

  return {
    title: "站点导航",
    meta: null,
    showTradingBadge: false
  };
}

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = resolveHeaderContext(pathname, new URLSearchParams(searchParams.toString()));

  const navItems = [
    { href: "/compare", label: "日报对比", icon: ArrowLeftRight, active: pathname === "/compare" },
    { href: "/archive", label: "历史日报", icon: Newspaper, active: pathname === "/archive" },
    { href: "/stocks", label: "股票管理", icon: Settings2, active: pathname === "/stocks" || pathname.startsWith("/stock/") }
  ];

  return (
    <div className="site-header-shell">
      <div className="site-header-inner">
        <div className="site-header">
          <Link href="/" className="site-header-head">
            <div className="site-header-brandline">
              <span className="site-header-mark" aria-hidden="true" />
              <p className="eyebrow">中概日报</p>
              <span className="site-header-title">{context.title}</span>
              {context.meta ? (
                <>
                  <span className="site-header-separator" aria-hidden="true">
                    /
                  </span>
                  <p className="meta">{context.meta}</p>
                </>
              ) : null}
              {context.showTradingBadge ? <Badge variant="outline">美东交易日</Badge> : null}
            </div>
          </Link>

          <div className="site-header-controls">
            <NavigationMenu viewport={false} className="site-header-actions-menu !flex-none !w-auto">
              <NavigationMenuList className="site-header-actions !flex-none !w-auto !justify-end">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavigationMenuItem key={item.href}>
                      <NavigationMenuLink
                        asChild
                        className={item.active ? "site-nav-link is-active" : "site-nav-link"}
                      >
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
                    <Link href="/">回到今天</Link>
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
