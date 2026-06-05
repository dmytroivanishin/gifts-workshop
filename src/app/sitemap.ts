import { MetadataRoute } from "next";
import { postService, categoryService } from "@/lib/container";
import { env } from "@/lib/env";

const appUrl = env.NEXT_PUBLIC_APP_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: `${appUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    // Fetch all published posts
    const result = await postService.getFilteredPosts({ status: "Published" });
    const posts = result.data || result; // Handle both paginated and raw array responses

    if (Array.isArray(posts)) {
      const postEntries: MetadataRoute.Sitemap = posts.map((post: any) => ({
        url: `${appUrl}/projects/${post.slug}`,
        lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));
      sitemapEntries.push(...postEntries);
    }
    
    // Optionally fetch categories if they have their own public pages
    // const categories = await categoryService.getAllCategories();
    // ... map categories ...
    
  } catch (error) {
    console.error("Error generating sitemap:", error);
  }

  return sitemapEntries;
}
