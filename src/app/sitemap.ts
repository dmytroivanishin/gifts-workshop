import { MetadataRoute } from "next";
import { postService, pageService } from "@/modules/core/container";
import { env } from "@/modules/core/env";
import { logger } from "@/modules/logger";
import { APP_URL, languageAlternates } from "@/utils/seo";


// Cached by default, so it would be built once with the DB state (or an unreachable DB) of `next build`
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = env.SUPPORTED_LOCALES;
  const sitemapEntries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    sitemapEntries.push({
      url: `${APP_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: languageAlternates()
      }
    });
  }

  try {
    // The fixed "site map" page and every info page, in each language.
    const infoPaths = ["sitemap", ...(await pageService.getAllPages()).map((page) => `pages/${page.slug}`)];
    for (const path of infoPaths) {
      for (const locale of locales) {
        sitemapEntries.push({
          url: `${APP_URL}/${locale}/${path}`,
          lastModified: new Date(),
          changeFrequency: "monthly",
          priority: 0.5,
          alternates: {
            languages: languageAlternates(`/${path}`)
          }
        });
      }
    }

    // Fetch all published posts
    const result = await postService.getFilteredPosts({ status: "Published" });
    const posts = result.data || result; // Handle both paginated and raw array responses

    if (Array.isArray(posts)) {
      for (const post of posts) {
        for (const locale of locales) {
          const postSlug = post.slug || post.id;
          sitemapEntries.push({
            url: `${APP_URL}/${locale}/posts/${postSlug}`,
            lastModified: post.createdAt ? new Date(post.createdAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
            alternates: {
              languages: languageAlternates(`/posts/${postSlug}`)
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
