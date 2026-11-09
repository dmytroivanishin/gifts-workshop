"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { getLocalizedField } from "@/utils/localization";
import { MenuPage } from "@/types/menu";

interface PublicFooterProps {
  pages: MenuPage[];
}

const LINK_CLASS = "whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs sm:tracking-wider";

// A thin strip with the same links as the header plus the site map. The homepage's infinite scroll
// means a visitor may never reach it there, which is why the header carries the page links too.
export function PublicFooter({ pages }: PublicFooterProps) {
  const { t, locale } = useTranslation();

  return (
    <footer className="mt-auto w-full border-t border-border">
      <nav
        aria-label={t("footer_nav_label")}
        className="container mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-2 gap-y-2 px-6 py-6 sm:gap-x-3 font-sans"
      >
        {pages.map((page) => (
          <Fragment key={page.slug}>
            <Link href={`/${locale}/pages/${page.slug}`} className={LINK_CLASS}>
              {getLocalizedField(page.title, locale)}
            </Link>
            <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
          </Fragment>
        ))}
        <Link href={`/${locale}/sitemap`} className={LINK_CLASS}>
          {t("site_map")}
        </Link>
      </nav>
    </footer>
  );
}
