import { MetadataRoute } from "next";
import { postService, categoryService } from "@/modules/core/container";
import { env } from "@/modules/core/env";

const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ['ru', 'en'];
  const sitemapEntries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    sitemapEntries.push({
      url: `${appUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: {
          'ru': `${appUrl}/ru`,
          'en': `${appUrl}/en`,
        }
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
          sitemapEntries.push({
            url: `${appUrl}/${locale}/projects/${post.id}`,
            lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
            alternates: {
              languages: {
                'ru': `${appUrl}/ru/projects/${post.id}`,
                'en': `${appUrl}/en/projects/${post.id}`,
              }
            }
          });
        }
      }
    }
  } catch (error) {
    console.error("Error generating sitemap:", error);
  }

  return sitemapEntries;
}
