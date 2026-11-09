import { MetadataRoute } from "next";
import { APP_URL } from "@/utils/seo";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
