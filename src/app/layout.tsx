import type { Metadata } from "next";
import "./globals.css";
import { ReduxProvider } from "@/store/Provider";
import { I18nProvider } from "@/i18n";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const siteTitle = process.env.SITE_TITLE || "Добрые Подарки (Kind Gifts) | Каталог ручной работы / Handmade Catalog";
const siteTemplate = process.env.SITE_TEMPLATE || "%s | Добрые Подарки (Kind Gifts)";
const siteDescription = process.env.SITE_DESCRIPTION || "Добрые Подарки — каталог душевной ручной работы. Уют на кухне: авторский текстиль, прихваточки, варежки и полотенца. Интерьерные куколки и мягкие плюшевые игрушки. Радость в деталях для любимого дома. | Kind Gifts — soulful handmade catalog. Kitchen textiles, potholders, oven mitts, and towels. Interior dolls and plush toys. Joy in details for your beloved home.";
const siteName = process.env.SITE_NAME || "Добрые Подарки";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: siteTitle,
    template: siteTemplate
  },
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: appUrl,
    siteName: siteName,
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
    locale: "ru_RU",
    alternateLocale: ["en_US"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/images/og-image.png"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="font-sans h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <ReduxProvider>
          <I18nProvider>
            {children}
          </I18nProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
