import { Metadata } from "next";
import { extractLocalizedTags } from "@/utils/tags";
import { getLocalizedField } from "@/utils/localization";
import { env } from "@/modules/core/env";
import { redirect } from "next/navigation";
import { isUUID } from "@/utils/uuid";
import { getVisiblePostBySlugOrId } from "@/utils/postLookup";
import { logger } from "@/modules/logger";

const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface PostLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string, slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string, slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const isEn = locale === 'en';

  try {
    // The page metadata is server-rendered into the HTML, so unpublished posts must be filtered here as well.
    // getVisiblePostBySlugOrId is React.cache()'d, so this and the page's own lookup of the same slug
    // share one DB round trip per request instead of two.
    const post = await getVisiblePostBySlugOrId(slug);

    if (!post) {
      return {
        title: isEn ? env.SITE_POST_NOT_FOUND_EN || "Project not found" : env.SITE_POST_NOT_FOUND_RU || "Проект не найден",
      };
    }

    const titleText = getLocalizedField(post.title, locale) || "Project";
    const siteName = isEn ? process.env.SITE_NAME_EN || "Kind Gifts" : process.env.SITE_NAME_RU || "Добрые Подарки";
    const title = `${titleText} | ${siteName}`;

    const description = getLocalizedField(post.description, locale);

    const keywords = extractLocalizedTags(post.tags, locale);

    let imageUrl = "/images/og-image.png";
    if (post.media && post.media.length > 0) {
      const firstMediaUrl = post.media[0]?.media?.originalUrl;
      if (firstMediaUrl) {
        imageUrl = firstMediaUrl.startsWith("http") ? firstMediaUrl : `${appUrl}${firstMediaUrl}`;
      }
    }

    const postSlug = post.slug || slug;

    return {
      title: titleText,
      description: description,
      keywords: keywords,
      openGraph: {
        title: title,
        description: description,
        url: `${appUrl}/${locale}/posts/${postSlug}`,
        siteName: siteName,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: titleText,
          },
        ],
        locale: isEn ? "en_US" : "ru_RU",
        type: "article",
      },
      alternates: {
        canonical: `${appUrl}/${locale}/posts/${postSlug}`,
        languages: {
          ...env.SUPPORTED_LOCALES.reduce((acc, l) => {
            acc[l] = `${appUrl}/${l}/posts/${postSlug}`;
            return acc;
          }, {} as Record<string, string>),
          // Matches proxy.ts's own fallback for a visitor with no saved locale and no matching
          // Accept-Language (NEXT_PUBLIC_DEFAULT_LOCALE_PUBLIC, "en" by default).
          'x-default': `${appUrl}/${process.env.NEXT_PUBLIC_DEFAULT_LOCALE_PUBLIC || "en"}/posts/${postSlug}`,
        },
      },
      twitter: {
        card: "summary_large_image",
        title: title,
        description: description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    logger.error("Error generating metadata for post", { slug, error: error instanceof Error ? error.message : String(error) });
    return {};
  }
}

export default async function PostLayout({ children, params }: PostLayoutProps) {
  const { locale, slug } = await params;
  if (isUUID(slug)) {
    const post = await getVisiblePostBySlugOrId(slug);
    if (post && post.slug) {
      redirect(`/${locale}/posts/${post.slug}`);
    }
  }
  return <>{children}</>;
}
