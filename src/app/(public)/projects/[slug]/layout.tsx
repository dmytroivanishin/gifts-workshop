import { Metadata } from "next";
import { postService } from "@/lib/container";
import { extractLocalizedTags } from "@/lib/utils";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const post = await postService.getPostBySlug(slug, { populate: "category,tags,media" });
    
    if (!post) {
      return {
        title: process.env.SITE_PROJECT_NOT_FOUND || "Проект не найден | Project not found",
      };
    }

    // Default locale fallback for title and description
    const title = post.title.ru || post.title.en || Object.values(post.title)[0] || process.env.SITE_PROJECT_DEFAULT || "Проект | Project";
    const description = post.description.ru || post.description.en || Object.values(post.description)[0] || "";

    // Extract all localized tags across all languages in a functional way
    const keywords = extractLocalizedTags(post.tags);

    // Get the first image as Open Graph cover image
    let imageUrl = "/images/og-image.png";
    if (post.media && post.media.length > 0) {
      const firstMediaUrl = post.media[0]?.media?.originalUrl;
      if (firstMediaUrl) {
        // Ensure absolute URL if it's stored relatively
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
        url: `${appUrl}/projects/${slug}`,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: "article",
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
