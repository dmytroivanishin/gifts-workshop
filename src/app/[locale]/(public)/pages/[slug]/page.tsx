import { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageService } from "@/modules/core/container";
import { BackToHomeLink } from "@/components/shared/BackToHomeLink";
import { getLocalizedField } from "@/utils/localization";
import { APP_URL, languageAlternates } from "@/utils/seo";
import { Page } from "@/types";


interface InfoPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

// Read from the cached page list (unstable_cache, invalidated on every admin write) instead of a
// query per request, so a busy info page does not hit Postgres each time.
async function findPage(slug: string): Promise<Page | undefined> {
  const pages = await pageService.getAllPages();
  return pages.find((page) => page.slug === slug);
}

// First 160 characters of the text with line breaks and runs of spaces collapsed: only for the
// <meta> description, the page itself keeps the text exactly as typed.
function toMetaDescription(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat;
}

export async function generateMetadata({ params }: InfoPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await findPage(slug);
  if (!page) return { title: locale === "en" ? "Page not found" : "Страница не найдена" };

  const title = getLocalizedField(page.title, locale);
  const description = toMetaDescription(getLocalizedField(page.description, locale));
  const url = `${APP_URL}/${locale}/pages/${page.slug}`;

  return {
    title,
    description: description || undefined,
    openGraph: { title, description: description || undefined, url, type: "website", locale: locale === "en" ? "en_US" : "ru_RU" },
    alternates: {
      canonical: url,
      languages: languageAlternates(`/pages/${page.slug}`, { withDefault: true }),
    },
  };
}

export default async function InfoPage({ params }: InfoPageProps) {
  const { locale, slug } = await params;
  const page = await findPage(slug);
  // A real 404 (not a soft "not found" text with status 200), same rule as the post page.
  if (!page) notFound();

  const title = getLocalizedField(page.title, locale);
  const description = getLocalizedField(page.description, locale);

  return (
    <article className="container mx-auto max-w-3xl px-6 pb-16 pt-8 font-sans">
      <BackToHomeLink />
      <h1 className="mb-8 font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
      {/* pre-wrap keeps the author's spaces, indents and blank lines; React escapes the text, so no HTML is ever injected. */}
      <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">{description}</div>
    </article>
  );
}
