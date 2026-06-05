"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "@/i18n";
import { usePathname, useRouter } from "next/navigation";

export function PublicHeader() {
  const { locale, setLocale } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const handleLanguageSwitch = () => {
    const newLocale = locale === "ru" ? "en" : "ru";
    const segments = pathname.split('/');
    
    // Replace the first segment if it matches the current locale
    if (segments[1] === locale) {
      segments[1] = newLocale;
    } else {
      // Fallback in case the locale is missing (should be handled by middleware)
      segments.splice(1, 0, newLocale);
    }
    
    const newPath = segments.join('/') || '/';
    
    setLocale(newLocale);
    router.push(newPath);
  };

  return (
    <div className="w-full">
      <div className="container mx-auto px-6 pt-10 pb-2 max-w-[1280px] font-sans flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe size={14} />
          <button
            onClick={handleLanguageSwitch}
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
