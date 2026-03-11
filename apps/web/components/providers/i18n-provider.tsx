"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";

import { createI18nInstance, type Language } from "@/lib/i18n";

type I18nProviderProps = {
  lang: Language;
  children: React.ReactNode;
};

export function I18nProvider(props: I18nProviderProps) {
  const { children, lang } = props;
  const [instance] = useState(() => createI18nInstance(lang));

  useEffect(() => {
    if (instance.resolvedLanguage !== lang) {
      void instance.changeLanguage(lang);
    }
  }, [instance, lang]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
