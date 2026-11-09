"use client";

import Link from "next/link";
import { NotFoundError } from "@/common/errors/notFound";
import { Home, Compass } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTranslation } from "@/i18n";
import { PublicHeader } from "@/components/shared/PublicHeader";

export default function NotFound() {
  const { t } = useTranslation();
  const errorInstance = new NotFoundError();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans relative overflow-hidden">
      <PublicHeader />

      {/* Decorative background elements to match the handmade aesthetic */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-[#F1E7E7] rounded-full blur-3xl opacity-40 -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#EAECE0] rounded-full blur-3xl opacity-40 -z-10 pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center max-w-lg mx-auto">
          <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-8 text-muted-foreground border border-border shadow-sm">
            <Compass size={36} strokeWidth={1.5} />
          </div>

        <h1 className="font-heading text-8xl font-bold tracking-tighter text-primary/10 mb-2 select-none">
          {errorInstance.statusCode}
        </h1>
        
        <h2 className="text-3xl md:text-4xl font-heading font-medium text-foreground mb-4">
          {t("error_404_title") || "Упс! Страница потерялась"}
        </h2>
        
        <p className="text-muted-foreground mb-10">
          {t("error_404_desc") || "Кажется, вы забрели в уголок мастерской, которого не существует."}
        </p>

        <Link
          href="/"
          className={cn(
            "inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer",
            "bg-secondary text-[#1F1B16] border border-transparent hover:border-[#1F1B16]/20 hover:shadow-sm"
          )}
        >
          <Home size={18} />
          <span>{t("error_404_back") || "Вернуться на главную"}</span>
        </Link>
      </div>
    </div>
    </div>
  );
}
