"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "@/i18n";
import { usePathname, useRouter } from "next/navigation";

export function PublicHeader() {
  const { locale, setLocale, activeLanguages } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const currentIndex = activeLanguages.indexOf(locale);
  const nextLocale = activeLanguages.length > 0 
    ? activeLanguages[(currentIndex + 1) % activeLanguages.length] 
    : "en";

  const handleLanguageSwitch = () => {
    const newLocale = nextLocale;
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

  // The homepage has nothing at its own top edge, so the switcher can overlay it (absolute,
  // reserving no layout space, per your request). Every other public page (the project page,
  // for one) has its own content starting right at the top — e.g. "back_to_gallery" — which an
  // absolute switcher would sit on top of, so those pages keep the original flow-based block
  // with its own reserved space, exactly as it was before.
  const isHome = pathname.replace(/\/$/, "") === `/${locale}`;

  if (isHome) {
    return (
      <div className="absolute top-0 left-0 w-full z-10">
        <div className="container mx-auto px-6 pt-10 max-w-[1280px] font-sans">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe size={14} />
            <button
              onClick={handleLanguageSwitch}
              className="hover:text-foreground font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {locale === "ru" ? "Русский" : locale === "en" ? "English" : locale.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="container mx-auto px-6 pt-10 pb-2 max-w-[1280px] font-sans flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe size={14} />
          <button
            onClick={handleLanguageSwitch}
            className="hover:text-foreground font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {locale === "ru" ? "Русский" : locale === "en" ? "English" : locale.toUpperCase()}
          </button>
        </div>
        <div />
      </div>
    </div>
  );
}
