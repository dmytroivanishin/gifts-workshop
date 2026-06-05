import { Metadata } from "next";
import { postService } from "@/lib/container";
import { extractLocalizedTags } from "@/lib/utils";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string, slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string, slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const isEn = locale === 'en';
  
  try {
    // We use getPostById since the slug parameter actually contains the ID from the URL
    // (as seen in the client component useGetPostByIdQuery)
    const post = await postService.getPostById(slug);
    
    if (!post) {
      return {
        title: isEn ? process.env.SITE_PROJECT_NOT_FOUND_EN || "Project not found" : process.env.SITE_PROJECT_NOT_FOUND_RU || "Проект не найден",
      };
    }

    const titleText = isEn ? (post.title.en || post.title.ru || "Project") : (post.title.ru || post.title.en || "Проект");
    const siteName = isEn ? process.env.SITE_NAME_EN || "Kind Gifts" : process.env.SITE_NAME_RU || "Добрые Подарки";
    const title = `${titleText} | ${siteName}`;

    const description = isEn ? (post.description.en || post.description.ru || "") : (post.description.ru || post.description.en || "");

    const allKeywords = extractLocalizedTags(post.tags);
    // Filter tags to only include the current locale if they are formatted properly,
    // otherwise just use all of them. Assuming extractLocalizedTags returns a string or array.
    // If it's a comma separated string, we just pass it as is.
    const keywords = allKeywords;

    let imageUrl = "/images/og-image.png";
    if (post.media && post.media.length > 0) {
      const firstMediaUrl = post.media[0]?.media?.originalUrl;
      if (firstMediaUrl) {
        imageUrl = firstMediaUrl.startsWith("http") ? firstMediaUrl : `${appUrl}${firstMediaUrl}`;
      }
    }

    return {
      title: title,
      description: description,
      keywords: keywords,
      openGraph: {
        title: title,
        description: description,
        url: `${appUrl}/${locale}/projects/${slug}`,
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
        languages: {
          'ru': `${appUrl}/ru/projects/${slug}`,
          'en': `${appUrl}/en/projects/${slug}`,
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
    console.error("Error generating metadata for post:", slug, error);
    return {};
  }
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  return <>{children}</>;
}
