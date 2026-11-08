import { Check } from "lucide-react";

import { cn } from "@/utils/cn";

// The checkbox drawn in the corner of a media card, in the library and in the picker modal, so
// both look the same: a rounded square, white over the photo when empty, teal when selected.
// Purely visual: the card (or a wrapping <label>) owns the click and the real checkbox state.
export function SelectionMark({
  selected,
  className,
}: {
  selected: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 items-center justify-center rounded-[7px] border transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-white/80 text-transparent",
        className
      )}
    >
      <Check size={14} />
    </span>
  );
}
