import { MetadataRoute } from "next";
import { env } from "@/lib/env";

const appUrl = env.NEXT_PUBLIC_APP_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
