"use client";

import { Search, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  // Extra classes for the field itself (e.g. a shorter height inside a dropdown).
  inputClassName?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

// Shared by admin/media and admin/posts — previously each page styled its own search box
// (different fill/border), so the same kind of control looked like two different components.
// The field itself stays the lightest element on the page (bg-card) — the surrounding toolbar
// div each page wraps it in carries the muted/border-border "plashka" tone, matching the
// dashboard table's own tr (border-b border-border bg-muted/50); see admin/media/page.tsx
// and admin/posts/page.tsx's filter bar for that wrapper.
export default function SearchInput({ value, onChange, placeholder, className = "", inputClassName = "", onKeyDown }: SearchInputProps) {
  const { t } = useTranslation();

  return (
    <div className={`relative w-full ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className={`pl-9 pr-9 ${inputClassName}`}
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clear_search")}
          title={t("clear_search")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-subtle-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
