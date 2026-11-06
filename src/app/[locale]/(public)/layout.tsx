import { Metadata } from "next";
import { PublicHeader } from "@/components/shared/PublicHeader";

interface PublicLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';

  const title = isEn ? process.env.SITE_TITLE_EN : process.env.SITE_TITLE_RU;
  const description = isEn ? process.env.SITE_DESCRIPTION_EN : process.env.SITE_DESCRIPTION_RU;
  const keywords = isEn ? process.env.SITE_KEYWORDS_EN : process.env.SITE_KEYWORDS_RU;
  const siteName = isEn ? process.env.SITE_NAME_EN : process.env.SITE_NAME_RU;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    title: {
      // `absolute`, not `default`: per Next's own docs, title.default still gets wrapped by the
      // closest ANCESTOR's own template (the root layout's) — so with `default` here, this value
      // (already a complete site title) was being wrapped twice, producing a doubled title like
      // "X | Site | Site". `absolute` provides the same fallback for this route's own children
      // (the project page) without being re-wrapped itself.
      absolute: title || "Мастерская подарков | Kind Gifts",
      template: isEn ? process.env.SITE_TEMPLATE_EN || "%s | Kind Gifts" : process.env.SITE_TEMPLATE_RU || "%s | Мастерская подарков"
    },
    description,
    keywords,
    openGraph: {
      title: title || "Добрые Подарки",
      description,
      url: `${appUrl}/${locale}`,
      siteName,
      images: [
        {
          url: "/images/og-image.png",
          width: 1200,
          height: 630,
          alt: siteName || "Добрые Подарки",
        },
      ],
      locale: isEn ? "en_US" : "ru_RU",
      type: "website",
    },
    alternates: {
      canonical: `${appUrl}/${locale}`,
      languages: {
        'ru': `${appUrl}/ru`,
        'en': `${appUrl}/en`,
        // Matches proxy.ts's own fallback for a visitor with no saved locale and no matching
        // Accept-Language (NEXT_PUBLIC_DEFAULT_LOCALE_PUBLIC, "en" by default).
        'x-default': `${appUrl}/${process.env.NEXT_PUBLIC_DEFAULT_LOCALE_PUBLIC || "en"}`,
      },
    },
    twitter: {
      card: "summary_large_image",
      title: title || "Добрые Подарки",
      description,
      images: ["/images/og-image.png"],
    },
  };
}

export default async function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
