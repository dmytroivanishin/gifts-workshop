import { PublicHeader } from "@/components/shared/PublicHeader";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t py-6 text-center text-muted-foreground">
        © {new Date().getFullYear()} {process.env.SITE_FOOTER || "Добрые Подарки | Kind Gifts. Все права защищены / All rights reserved."}
      </footer>
    </div>
  );
}
