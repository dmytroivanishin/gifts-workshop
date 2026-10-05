import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});
import { ReduxProvider } from "@/store/Provider";
import { I18nProvider } from "@/i18n";
import { systemTextService } from "@/modules/core/container";
import { env } from "@/modules/core/env";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const siteTitle = process.env.SITE_TITLE || "Добрые Подарки (Kind Gifts) | Каталог ручной работы / Handmade Catalog";
const siteTemplate = process.env.SITE_TEMPLATE || "%s | Добрые Подарки (Kind Gifts)";
const siteDescription = process.env.SITE_DESCRIPTION || "Добрые Подарки — каталог душевной ручной работы. Уют на кухне: авторский текстиль, прихваточки, варежки и полотенца. Интерьерные куколки и мягкие плюшевые игрушки. Радость в деталях для любимого дома. | Kind Gifts — soulful handmade catalog. Kitchen textiles, potholders, oven mitts, and towels. Interior dolls and plush toys. Joy in details for your beloved home.";
const siteName = process.env.SITE_NAME || "Добрые Подарки";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: siteTitle,
    template: siteTemplate,
  },
  description: siteDescription,
  applicationName: siteName,
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get('x-locale') || env.DEFAULT_LOCALE;
  const isAdmin = headersList.get('x-is-admin') === 'true';

  // Fetch only system texts on the server
  // If we are in admin, fetch everything (no area filter). 
  // If we are on public, fetch only public (and shared) texts.
  const systemTextsRes = await systemTextService.getAllSystemTexts({ limit: 2000, area: isAdmin ? undefined : 'public' });

  const activeLanguages = env.SUPPORTED_LOCALES;

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${playfairDisplay.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ReduxProvider>
          <I18nProvider 
            systemTexts={systemTextsRes.data || []} 
            initialLocale={locale}
            activeLanguages={activeLanguages}
          >
            {children}
          </I18nProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
