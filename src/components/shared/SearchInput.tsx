"use client";

import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Shared by admin/media and admin/dashboard — previously each page styled its own search box
// (different fill/border), so the same kind of control looked like two different components.
// The field itself stays the lightest element on the page (bg-card) — the surrounding toolbar
// div each page wraps it in carries the muted/border-border/60 "plashka" tone, matching the
// dashboard table's own tr (border-b border-border/60 bg-muted/50); see admin/media/page.tsx
// and admin/dashboard/page.tsx's filter bar for that wrapper.
export default function SearchInput({ value, onChange, placeholder, className = "" }: SearchInputProps) {
  return (
    <div className={`relative w-full ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 sm:py-2 rounded-lg border border-border bg-card font-sans text-sm outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
      />
    </div>
  );
}
