"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useGetLanguagesQuery, useGetSystemTextsQuery } from "@/store/api";

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

export function I18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  const { data: languagesData, isLoading: isLoadingLangs } = useGetLanguagesQuery();
  const { data: systemTextsData, isLoading: isLoadingTexts } = useGetSystemTextsQuery({ limit: 1000 });

  const [locale, setLocaleState] = useState<Locale>("");
  
  const activeLanguages = useMemo(() => {
    if (!languagesData?.data) return ["ru", "en"]; // Initial fallback before load
    return languagesData.data.filter(l => l.isActive).map(l => l.code);
  }, [languagesData]);

  const defaultAdmin = process.env.NEXT_PUBLIC_DEFAULT_ADMIN_LOCALE || "ru";
  const defaultApp = process.env.NEXT_PUBLIC_DEFAULT_APP_LOCALE || "en";

  useEffect(() => {
    if (typeof window !== "undefined" && !isLoadingLangs) {
      const isAdmin = pathname?.startsWith("/admin");
      const key = isAdmin ? "admin_locale" : "app_locale";
      const saved = localStorage.getItem(key);
      const defaultLocale = isAdmin ? defaultAdmin : defaultApp;
      
      if (saved && activeLanguages.includes(saved)) {
        setLocaleState(saved);
      } else if (activeLanguages.includes(defaultLocale)) {
        setLocaleState(defaultLocale);
      } else if (activeLanguages.length > 0) {
        setLocaleState(activeLanguages[0]);
      }
    }
  }, [pathname, activeLanguages, defaultAdmin, defaultApp, isLoadingLangs]);

  const setLocale = (newLocale: Locale) => {
    if (!activeLanguages.includes(newLocale)) return;
    setLocaleState(newLocale);
    const isAdmin = pathname?.startsWith("/admin");
    const key = isAdmin ? "admin_locale" : "app_locale";
    localStorage.setItem(key, newLocale);
  };

  const dictionaries = useMemo(() => {
    const dicts: Record<string, Record<string, string>> = {};
    activeLanguages.forEach(lang => {
      dicts[lang] = {};
    });
    
    if (systemTextsData?.data) {
      systemTextsData.data.forEach(text => {
        const key = text.id;
        activeLanguages.forEach(lang => {
          dicts[lang][key] = text.content[lang] || key; // fallback to key itself if not translated
        });
      });
    }
    return dicts;
  }, [systemTextsData, activeLanguages]);

  const t = (key: string): string => {
    if (!locale) return key;
    const dict = dictionaries[locale] || {};
    return dict[key] || key;
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

  const isLoading = isLoadingLangs || isLoadingTexts;

  return (
    <I18nContext.Provider value={{ locale: locale || defaultAdmin, setLocale, activeLanguages, t, loc, isLoading }}>
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
