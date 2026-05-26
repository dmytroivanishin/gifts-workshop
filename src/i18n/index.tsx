"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import ru from "./ru.json";
import en from "./en.json";

type Locale = "ru" | "en";
const dictionaries = { ru, en };

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof ru) => string;
  loc: (field: any) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_locale") as Locale;
      if (saved === "ru" || saved === "en") {
        setLocaleState(saved);
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("app_locale", newLocale);
  };

  const t = (key: keyof typeof ru): string => {
    const dict = dictionaries[locale] || dictionaries.ru;
    return (dict as any)[key] || key;
  };

  const loc = (field: any): string => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") {
      return field[locale] || field.ru || field.en || "";
    }
    return String(field);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, loc }}>
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
