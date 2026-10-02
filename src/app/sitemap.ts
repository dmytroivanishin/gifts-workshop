import { MetadataRoute } from "next";
import { postService, categoryService } from "@/modules/core/container";
import { env } from "@/modules/core/env";
import { logger } from "@/modules/logger";

const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Cached by default, so it would be built once with the DB state (or an unreachable DB) of `next build`
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = env.SUPPORTED_LOCALES;
  const sitemapEntries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    sitemapEntries.push({
      url: `${appUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: locales.reduce((acc, l) => {
          acc[l] = `${appUrl}/${l}`;
          return acc;
        }, {} as Record<string, string>)
      }
    });
  }

  try {
    // Fetch all published posts
    const result = await postService.getFilteredPosts({ status: "Published" });
    const posts = result.data || result; // Handle both paginated and raw array responses

    if (Array.isArray(posts)) {
      for (const post of posts) {
        for (const locale of locales) {
          const projectSlug = post.slug || post.id;
          sitemapEntries.push({
            url: `${appUrl}/${locale}/projects/${projectSlug}`,
            lastModified: post.createdAt ? new Date(post.createdAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
            alternates: {
              languages: locales.reduce((acc, l) => {
                acc[l] = `${appUrl}/${l}/projects/${projectSlug}`;
                return acc;
              }, {} as Record<string, string>)
            }
          });
        }
      }
    }
  } catch (error) {
    logger.error("Error generating sitemap", { error: error instanceof Error ? error.message : String(error) });
  }

  return sitemapEntries;
}
