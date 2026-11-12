import { Metadata } from "next";
import { extractLocalizedTags } from "@/utils/tags";
import { getLocalizedField } from "@/utils/localization";
import { systemTextService } from "@/modules/core/container";
import { redirect } from "next/navigation";
import { isUUID } from "@/utils/uuid";
import { getVisiblePostBySlugOrId } from "@/utils/postLookup";
import { logger } from "@/modules/logger";
import { APP_URL, languageAlternates } from "@/utils/seo";


interface PostLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string, slug: string }>;
}

// Same text the not-found page shows in the body (system_texts code `post_not_found`), so the tab
// title and the visible heading can never disagree. Read through the cached service, not the DB.
async function loadNotFoundTitle(locale: string): Promise<string> {
  const fallback = locale === "en" ? "Work not found" : "Работа не найдена";
  const texts = (await systemTextService.getAllSystemTexts({ limit: 2000, area: "public" })).data ?? [];
  const text = texts.find((systemText) => systemText.code === "post_not_found");
  return text ? getLocalizedField(text.content, locale) || fallback : fallback;
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
      return { title: await loadNotFoundTitle(locale) };
    }

    const titleText = getLocalizedField(post.title, locale) || "Work";
    const siteName = isEn ? process.env.SITE_NAME_EN || "Kind Gifts" : process.env.SITE_NAME_RU || "Добрые Подарки";
    const title = `${titleText} | ${siteName}`;

    const description = getLocalizedField(post.description, locale);

    const keywords = extractLocalizedTags(post.tags, locale);

    let imageUrl = "/images/og-image.png";
    if (post.media && post.media.length > 0) {
      const firstMediaUrl = post.media[0]?.media?.originalUrl;
      if (firstMediaUrl) {
        imageUrl = firstMediaUrl.startsWith("http") ? firstMediaUrl : `${APP_URL}${firstMediaUrl}`;
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
        url: `${APP_URL}/${locale}/posts/${postSlug}`,
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
        canonical: `${APP_URL}/${locale}/posts/${postSlug}`,
        languages: languageAlternates(`/posts/${postSlug}`, { withDefault: true }),
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
