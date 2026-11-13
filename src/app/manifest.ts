import type { MetadataRoute } from "next";

// Android Chrome takes the home-screen icon and name from this manifest; without it the shortcut
// falls back to a letter. Icons are generated from public/images/icon.png and live in public/icons/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.SITE_NAME_RU || "Мастерская подарков",
    short_name: process.env.SITE_NAME_RU || "Мастерская подарков",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFBF7",
    theme_color: "#FDFBF7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
