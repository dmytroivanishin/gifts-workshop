"use client";

import { useEffect } from "react";
import { InternalServerError } from "@/common/errors/internalServer";
import { RefreshCcw, Home, Wrench } from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { PublicHeader } from "@/components/shared/PublicHeader";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  const errorInstance = new InternalServerError();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans relative overflow-hidden">
      <PublicHeader />
      
      {/* Decorative background elements */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#F1E7E7] rounded-full blur-3xl opacity-30 -z-10 pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#EAECE0] rounded-full blur-3xl opacity-40 -z-10 pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center max-w-lg mx-auto">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-8 text-destructive border border-destructive/20 shadow-sm animate-pulse">
            <Wrench size={36} strokeWidth={1.5} />
          </div>

        <h1 className="font-heading text-8xl font-bold tracking-tighter text-destructive/10 mb-2 select-none">
          {errorInstance.statusCode}
        </h1>
        
        <h2 className="text-3xl md:text-4xl font-heading font-medium text-foreground mb-4">
          {t("error_500_title") || "Что-то пошло не так"}
        </h2>
        
        <p className="text-muted-foreground mb-10 max-w-md">
          {t("error_500_desc") || "У нас запутались ниточки или мы случайно укололи сервер иголочкой. Извините за временные неудобства, мы уже всё чиним."}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button
            onClick={() => reset()}
            className={cn(
              "inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer",
              "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
            )}
          >
            <RefreshCcw size={16} />
            <span>{t("error_500_retry") || "Попробовать снова"}</span>
          </button>
          
          <Link
            href="/"
            className={cn(
              "inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer",
              "bg-secondary text-[#1F1B16] border border-transparent hover:border-[#1F1B16]/20 hover:shadow-sm"
            )}
          >
            <Home size={16} />
            <span>{t("error_500_back") || "На главную"}</span>
          </Link>
        </div>
      </div>
    </div>
    </div>
  );
}
