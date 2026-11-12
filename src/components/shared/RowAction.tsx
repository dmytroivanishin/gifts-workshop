import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/utils/cn";

// One icon button for list rows (edit, delete, view, approve...). The icon size and padding live
// here so every admin list looks the same; pages only choose the icon, the tone and the handler.
const ICON_SIZE = 18;

const TONES = {
  default: "text-subtle-foreground hover:bg-muted hover:text-foreground",
  destructive: "text-subtle-foreground hover:bg-muted hover:text-destructive",
  success: "text-subtle-foreground hover:bg-[#7D8945]/10 hover:text-lime-text",
  danger: "text-subtle-foreground hover:bg-[#B87070]/10 hover:text-[#8F4A4A]",
} as const;

interface RowActionProps {
  icon: LucideIcon;
  title: string;
  tone?: keyof typeof TONES;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}

export function RowAction({
  icon: Icon,
  title,
  tone = "default",
  active = false,
  onClick,
  href,
  external = false,
  disabled = false,
}: RowActionProps): React.ReactElement {
  const className = cn(
    "flex items-center justify-center rounded-md p-2 transition-colors cursor-pointer disabled:opacity-50",
    TONES[tone],
    active && "bg-muted text-foreground"
  );
  const icon = <Icon size={ICON_SIZE} />;

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        title={title}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} title={title}>
      {icon}
    </button>
  );
}

export function RowActions({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="flex flex-shrink-0 items-center gap-2">{children}</div>;
}
