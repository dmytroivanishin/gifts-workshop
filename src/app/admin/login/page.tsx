"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ShieldAlert, Loader2, KeyRound } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useTranslation } from "@/i18n";

function LoginContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const exchangeStarted = useRef(false);

  // Server messages are English; show the localized text for the error code, or a generic one.
  const errorText = useCallback(
    (data: { error?: { code?: string } } | undefined, fallbackKey: string): string => {
      const code = data?.error?.code;
      const translated = code ? t(code) : "";
      return translated && translated !== code ? translated : t(fallbackKey);
    },
    [t]
  );

  // Exchange Google Authorization Code for JWT Access/Refresh tokens
  const handleCodeExchange = useCallback(async (code: string, state: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/google/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(errorText(data, "GOOGLE_LOGIN_FAILED"));
      }

      router.push("/admin/dashboard");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("GOOGLE_LOGIN_FAILED"));
      // Drops the used code and state from the address bar
      router.replace("/admin/login");
      setIsLoading(false);
    }
  }, [router, t, errorText]);

  useEffect(() => {
    // Detect if we are in local development to show the bypass button
    if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
      setIsDev(true);
    }

    // Google sends the user back with ?code=...&state=...; a code works once and React StrictMode runs effects twice in dev
    const code = searchParams.get("code");
    if (code && !exchangeStarted.current) {
      exchangeStarted.current = true;
      handleCodeExchange(code, searchParams.get("state") ?? "");
    }
  }, [searchParams, handleCodeExchange]);

  // Standard Google login flow initiation: the server builds the authorize URL and remembers state and PKCE verifier
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/google/start", { method: "POST" });
      const data = await res.json();
      const googleAuthUrl: unknown = data.data?.url;

      if (!res.ok || typeof googleAuthUrl !== "string") {
        throw new Error(errorText(data, "GOOGLE_LOGIN_FAILED"));
      }

      window.location.href = googleAuthUrl;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("GOOGLE_LOGIN_FAILED"));
      setIsLoading(false);
    }
  };

  // Developer Bypass Login (local development only)
  const handleDevBypass = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/dev-login", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(errorText(data, "UNKNOWN_ERROR"));
      }

      router.push("/admin/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("UNKNOWN_ERROR"));
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] bg-white rounded-3xl border border-border p-8 flex flex-col items-center space-y-8">
      
      {/* Logo */}
      <Image
        src="/images/logo.png"
        alt="Добрые Подарки"
        width={180}
        height={60}
        priority
        className="h-auto w-auto max-w-[180px]"
      />

      {/* Text */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("login_title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("login_subtitle")}
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-full border border-border bg-white text-subtle-foreground hover:text-foreground hover:bg-muted/30 transition-all font-medium text-sm cursor-pointer disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="animate-spin text-muted-foreground" size={18} />
        ) : (
          <svg className="w-[18px] h-[18px] flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{t("login_with_google")}</span>
      </button>

      {/* Dev Bypass Login Option */}
      {isDev && (
        <button
          onClick={handleDevBypass}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-secondary text-subtle-foreground hover:text-foreground hover:bg-secondary/80 transition-all font-medium text-xs cursor-pointer disabled:opacity-50"
        >
          <KeyRound size={14} />
          <span>{t("login_dev_bypass")}</span>
        </button>
      )}

      {/* Warning / Guard Info */}
      <div className="flex gap-2.5 items-start bg-amber-500/10 p-3 rounded-2xl border border-amber-500/25 text-amber-800 text-[11px] leading-relaxed">
        <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
        <span>{t("login_admin_only")}</span>
      </div>

    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] font-sans px-4">
      <Suspense fallback={<Loader2 className="animate-spin text-muted-foreground" size={24} />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
