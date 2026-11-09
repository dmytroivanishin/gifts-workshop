"use client";

import { createContext, useContext, ReactNode, useMemo, useState } from "react";
import { getLocalizedField } from "@/utils/localization";
import { SystemText, LocalizedText } from "@/types";

type Locale = string;

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  activeLanguages: string[];
  t: (key: string) => string;
  loc: (field: LocalizedText | string | null | undefined) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  systemTexts: SystemText[];
  initialLocale: Locale;
  activeLanguages: string[];
}

export function I18nProvider({ children, systemTexts, initialLocale, activeLanguages }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru";

  // Admin has no language switcher (forced to ru in proxy.ts) — only the public site's own
  // switcher calls this now, so it only ever needs to persist the public NEXT_LOCALE cookie.
  const setLocale = (newLocale: Locale) => {
    if (!activeLanguages.includes(newLocale)) return;

    // 1. Instant client-side update
    setLocaleState(newLocale);

    // Update HTML lang attribute immediately
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }

    // 2. Set cookie for future SSR renders
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`; // 1 year
  };

  const dictionaries = useMemo(() => {
    const dicts: Record<string, Record<string, string>> = {};
    if (systemTexts) {
      systemTexts.forEach(text => {
        dicts[text.code] = text.content;
      });
    }
    return dicts;
  }, [systemTexts]);

  const t = (key: string): string => {
    if (!locale) return key;
    const item = dictionaries[key];
    if (!item) return key;
    return item[locale] || key;
  };

  const loc = (field: LocalizedText | string | null | undefined): string =>
    getLocalizedField(field, locale, defaultLocale);

  return (
    <I18nContext.Provider value={{ locale, setLocale, activeLanguages, t, loc, isLoading: false }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
