import type { Metadata } from "next";
import "./globals.css";
import { ReduxProvider } from "@/store/Provider";
import { I18nProvider } from "@/i18n";

export const metadata: Metadata = {
  title: "Добрые Подарки | Портфолио",
  description: "Handmade gifts portfolio catalog",
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
