"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, LayoutDashboard, FolderTree, Layers, Hash, Palette, Globe, Image as ImageIcon, MessageSquare } from "lucide-react";
import { useTranslation } from "@/i18n";
import { GlobalToaster } from "@/components/shared/GlobalToaster";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale, setLocale, activeLanguages } = useTranslation();

  const handleLanguageSwitch = () => {
    const currentIndex = activeLanguages.indexOf(locale);
    const nextLocale = activeLanguages.length > 0 
      ? activeLanguages[(currentIndex + 1) % activeLanguages.length] 
      : "en";
    setLocale(nextLocale);
  };

  // Remove admin_logged_in from localStorage if it exists to cleanup legacy
  useEffect(() => {
    localStorage.removeItem("admin_logged_in");
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error(error);
    } finally {
      router.push("/admin/login");
    }
  };

  if (pathname === "/admin/login") {
    return (
      <>
        <GlobalToaster />
        {children}
      </>
    );
  }

  const navLinks = [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: t("projects") },
    { href: "/admin/categories", icon: FolderTree, label: t("categories") },
    { href: "/admin/collections", icon: Layers, label: t("collections") },
    { href: "/admin/tags", icon: Hash, label: t("tags_manager") },
    { href: "/admin/colors", icon: Palette, label: t("colors_manager") },
    { href: "/admin/localizations", icon: Globe, label: t("translations") },
    { href: "/admin/media", icon: ImageIcon, label: t("media_library") },
    { href: "/admin/comments", icon: MessageSquare, label: t("comments") || "Comments" },
  ];

  return (
    <div className="admin-area min-h-screen flex bg-background text-foreground font-sans pb-[60px] md:pb-0">
      <GlobalToaster />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-secondary flex-shrink-0">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-primary">{t("admin_panel")}</h2>
        </div>
        <nav className="p-4 flex flex-col gap-1">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors block flex items-center gap-2 ${
                  isActive ? "bg-muted text-foreground" : "hover:bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden h-14 border-b bg-background flex items-center px-4 justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-primary">{t("admin_panel")}</h2>
          <div className="flex items-center space-x-3">
            <div className="flex items-center gap-1 border-r pr-3 border-border/80">
              <button
                onClick={handleLanguageSwitch}
                className="px-2 py-1 bg-secondary text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all rounded-md uppercase tracking-wider cursor-pointer"
              >
                {locale.toUpperCase()}
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex h-14 border-b bg-background items-center px-6 flex-shrink-0">
          <div className="ml-auto flex items-center space-x-4">
            {/* Admin Area Locale Selector */}
            <div className="flex items-center gap-1 border-r pr-4 border-border/80">
              <button
                onClick={handleLanguageSwitch}
                className="px-2 py-1 bg-secondary text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all rounded-md uppercase tracking-wider cursor-pointer"
                title={t('switch_language')}
              >
                {locale.toUpperCase()}
              </button>
            </div>

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
        
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-background border-t flex items-center overflow-x-auto overflow-y-hidden z-50 scrollbar-none">
        <div className="flex items-center px-2 min-w-full justify-start sm:justify-around gap-2">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center min-w-[72px] px-2 h-full py-2 space-y-1 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <link.icon size={20} className={isActive ? "fill-primary/10" : ""} />
                <span className="text-[10px] font-medium whitespace-nowrap truncate max-w-[70px]">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
