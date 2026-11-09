"use client";

import { Fragment } from "react";
import { Globe } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { usePathname, useRouter } from "next/navigation";
import { getLocalizedField } from "@/utils/localization";
import { cn } from "@/utils/cn";
import { MenuPage } from "@/types/menu";

interface PublicHeaderProps {
  // Optional: the error and 404 screens render outside the public layout and have no page list.
  pages?: MenuPage[];
}

const LINK_CLASS = "whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs sm:tracking-wider";

export function PublicHeader({ pages = [] }: PublicHeaderProps) {
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

  // Derived from the URL's own shape (exactly one segment, i.e. just "/ru" or "/en" with
  // nothing after it) rather than comparing against `locale` from the i18n context: `locale`
  // updates optimistically the instant the switcher is clicked (setLocaleState), before
  // router.push() has actually navigated and pathname has caught up — comparing against it
  // caused a one-frame isHome=false flicker that briefly shoved the whole page down and back.
  const segments = pathname.split("/").filter(Boolean);
  const isHome = segments.length === 1;

  // The homepage has nothing at its own top edge, so on a wide screen the header can overlay it
  // (absolute, reserving no space). On a phone the logo is wide enough to run under the language
  // switcher and the page links, so there the header sits in the normal flow and pushes the logo
  // down instead. Every other page starts with its own content at the top and always keeps the
  // header in the flow.
  return (
    <header
      className={cn(
        "relative z-10 w-full",
        isHome && "md:absolute md:left-0 md:top-0"
      )}
    >
      <div
        className={cn(
          "container mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-2 gap-y-2 px-6 font-sans sm:gap-x-6",
          isHome ? "pb-2 pt-5 md:pb-0 md:pt-10" : "pb-2 pt-10"
        )}
      >
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
          <Globe size={14} />
          <button
            onClick={handleLanguageSwitch}
            className="hover:text-foreground font-semibold uppercase tracking-wide transition-colors cursor-pointer sm:tracking-wider"
          >
            {locale === "ru" ? "Русский" : locale === "en" ? "English" : locale.toUpperCase()}
          </button>
        </div>

        {pages.length > 0 && (
          <nav className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-x-3">
            {pages.map((page, index) => (
              <Fragment key={page.slug}>
                {index > 0 && <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />}
                <Link href={`/${locale}/pages/${page.slug}`} className={LINK_CLASS}>
                  {getLocalizedField(page.title, locale)}
                </Link>
              </Fragment>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
