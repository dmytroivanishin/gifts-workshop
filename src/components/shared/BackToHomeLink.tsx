"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/i18n";

// The same "back" link the post page has, for the pages that have no other way to the homepage.
export function BackToHomeLink() {
  const { t, locale } = useTranslation();

  return (
    <Link
      href={`/${locale}`}
      className="mb-8 inline-flex items-center font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft size={20} className="mr-1" />
      {t("back_to_home")}
    </Link>
  );
}
