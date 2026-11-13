// Web app manifest for the admin area. Served from a path with a file extension, so the proxy's
// /admin guard does not apply to it. start_url points at the admin list, not the public home page.
export function GET(): Response {
  const siteName = process.env.SITE_NAME_RU || "Мастерская подарков";
  return Response.json(
    {
      name: `${siteName}: админка`,
      short_name: "Админка",
      start_url: "/admin/posts",
      scope: "/admin/",
      display: "standalone",
      background_color: "#FDFBF7",
      theme_color: "#FDFBF7",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
