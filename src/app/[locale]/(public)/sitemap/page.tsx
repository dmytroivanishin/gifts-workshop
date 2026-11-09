import { Metadata } from "next";
import Link from "next/link";
import { pageService, systemTextService } from "@/modules/core/container";
import { env } from "@/modules/core/env";
import { BackToHomeLink } from "@/components/shared/BackToHomeLink";
import { getLocalizedField } from "@/utils/localization";

const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SiteMapPageProps {
  params: Promise<{ locale: string }>;
}

// The human-readable map of the site. Its structure is fixed in code; only the list of info pages
// follows the database, so a newly created page is linked here without anyone editing this file.
async function loadLabels(locale: string): Promise<{ siteMap: string; home: string; pages: string }> {
  const texts = (await systemTextService.getAllSystemTexts({ limit: 2000, area: "public" })).data ?? [];
  const label = (code: string, fallback: string): string => {
    const text = texts.find((t) => t.code === code);
    return text ? getLocalizedField(text.content, locale) || fallback : fallback;
  };
  return {
    siteMap: label("site_map", locale === "en" ? "Site map" : "Карта сайта"),
    home: label("site_map_home", locale === "en" ? "Home" : "Главная"),
    pages: label("site_map_pages", locale === "en" ? "Info pages" : "Информационные страницы"),
  };
}

export async function generateMetadata({ params }: SiteMapPageProps): Promise<Metadata> {
  const { locale } = await params;
  const labels = await loadLabels(locale);
  const url = `${appUrl}/${locale}/sitemap`;
  return {
    title: labels.siteMap,
    alternates: {
      canonical: url,
      languages: env.SUPPORTED_LOCALES.reduce((acc, l) => {
        acc[l] = `${appUrl}/${l}/sitemap`;
        return acc;
      }, {} as Record<string, string>),
    },
  };
}

export default async function SiteMapPage({ params }: SiteMapPageProps) {
  const { locale } = await params;
  const [labels, pages] = await Promise.all([loadLabels(locale), pageService.getAllPages()]);

  return (
    <article className="container mx-auto max-w-3xl px-6 pb-16 pt-8 font-sans">
      <BackToHomeLink />
      <h1 className="mb-8 font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{labels.siteMap}</h1>
      <ul className="space-y-6 text-base text-foreground">
        <li>
          <Link href={`/${locale}`} className="hover:underline">{labels.home}</Link>
        </li>
        {pages.length > 0 && (
          <li>
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{labels.pages}</span>
            <ul className="mt-3 space-y-2 border-l border-border pl-4">
              {pages.map((page) => (
                <li key={page.id}>
                  <Link href={`/${locale}/pages/${page.slug}`} className="hover:underline">
                    {getLocalizedField(page.title, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </article>
  );
}
