"use client";

import { createContext, useContext, ReactNode, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SystemText } from "@/types";

type Locale = string;

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  activeLanguages: string[];
  t: (key: string) => string;
  loc: (field: any) => string;
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
  const pathname = usePathname();
  const router = useRouter();
  
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const defaultAdmin = process.env.NEXT_PUBLIC_DEFAULT_ADMIN_LOCALE || "ru";
  const defaultApp = process.env.NEXT_PUBLIC_DEFAULT_APP_LOCALE || "ru";

  const setLocale = (newLocale: Locale) => {
    if (!activeLanguages.includes(newLocale)) return;
    
    // 1. Instant client-side update
    setLocaleState(newLocale);
    
    // Update HTML lang attribute immediately
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }

    const isAdmin = pathname?.startsWith("/admin");
    const cookieName = isAdmin ? "admin_locale" : "NEXT_LOCALE";
    
    // 2. Set cookie for future SSR renders
    document.cookie = `${cookieName}=${newLocale}; path=/; max-age=31536000`; // 1 year
  };

  const dictionaries = useMemo(() => {
    const dicts: Record<string, Record<string, string>> = {};
    if (systemTexts) {
      systemTexts.forEach(text => {
        dicts[text.id] = text.content;
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

  const loc = (field: any): string => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") {
      const isAdmin = typeof window !== "undefined" && pathname?.startsWith("/admin");
      const defaultLocale = isAdmin ? defaultAdmin : defaultApp;

      if (field[locale]) return field[locale];
      if (field[defaultLocale]) return field[defaultLocale];
      const availableKeys = Object.keys(field).filter(k => field[k]);
      if (availableKeys.length > 0) return field[availableKeys[0]];
      return "";
    }
    return String(field);
  };

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
