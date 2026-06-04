"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "@/i18n";
import Link from "next/link";

export function PublicHeader() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="w-full">
      <div className="container mx-auto px-6 pt-10 pb-2 max-w-[1280px] font-sans flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe size={14} />
          <button
            onClick={() => setLocale(locale === "ru" ? "en" : "ru")}
            className="hover:text-foreground font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {locale === "ru" ? "English" : "Русский"}
          </button>
        </div>
        {/* Placeholder for symmetric spacing if needed later */}
        <div />
      </div>
    </div>
  );
}
