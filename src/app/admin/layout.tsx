"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("admin_logged_in") === "true";
    if (!isLoggedIn && pathname !== "/admin/login") {
      router.push("/admin/login");
    } else {
      setAuthorized(true);
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_logged_in");
    router.push("/admin/login");
  };

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!authorized) {
    return <div className="min-h-screen bg-[#FDFBF7]" />;
  }

  return (
    <div className="admin-area min-h-screen flex bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-secondary flex-shrink-0">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-primary">{t("admin_panel")}</h2>
        </div>
        <nav className="p-4 flex flex-col gap-1">
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-background transition-colors block text-foreground"
          >
            {t("projects")}
          </Link>
          <Link
            href="/admin/categories"
            className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-background transition-colors block text-foreground"
          >
            {t("categories")}
          </Link>
          <Link
            href="/admin/collections"
            className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-background transition-colors block text-foreground"
          >
            {t("collections")}
          </Link>
          <Link
            href="/admin/tags"
            className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-background transition-colors block text-foreground"
          >
            {t("tags_manager")}
          </Link>
          <Link
            href="/admin/localizations"
            className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-background transition-colors block text-foreground"
          >
            {t("translations")}
          </Link>
          <Link
            href="/admin/media"
            className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-background transition-colors block text-foreground"
          >
            {t("media_library")}
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-background flex items-center px-6">
          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm font-medium text-foreground">Admin</span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
