"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Language } from "@/lib/i18n";

type ThemeToggleProps = {
  lang: Language;
};

type ThemeOption = "light" | "dark";

function getThemeMenuLabel(lang: Language) {
  return lang === "zh" ? "主题" : "Theme";
}

function getThemeLabel(theme: ThemeOption, lang: Language) {
  if (lang === "zh") {
    return theme === "dark" ? "深色" : "浅色";
  }

  return theme === "dark" ? "Dark" : "Light";
}

export function ThemeToggle(props: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme: ThemeOption = mounted && resolvedTheme === "light" ? "light" : "dark";
  const CurrentIcon = currentTheme === "dark" ? MoonStar : SunMedium;
  const options: Array<{ value: ThemeOption; icon: typeof MoonStar }> = [
    { value: "dark", icon: MoonStar },
    { value: "light", icon: SunMedium }
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="site-language-trigger">
          <CurrentIcon className="h-3.5 w-3.5" />
          {mounted ? getThemeLabel(currentTheme, props.lang) : getThemeMenuLabel(props.lang)}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} collisionPadding={12} className="site-language-menu">
        <DropdownMenuLabel>{getThemeMenuLabel(props.lang)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {options.map((option) => {
            const OptionIcon = option.icon;
            const active = option.value === currentTheme;

            return (
              <DropdownMenuItem
                key={option.value}
                className="site-language-menu-item w-full"
                onSelect={() => {
                  setTheme(option.value);
                }}
              >
                <OptionIcon className="h-4 w-4" />
                <span className="font-medium text-foreground">{getThemeLabel(option.value, props.lang)}</span>
                {active ? <Check className="ml-auto h-4 w-4" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
