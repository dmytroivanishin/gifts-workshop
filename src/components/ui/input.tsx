import * as React from "react";

import { cn } from "@/utils/cn";

// The one look for every admin text field, taken from the media search box: card fill, plain
// border-border outline, rounded-lg, focus changes only the border colour (no ring, no shadow).
// aria-invalid (set automatically by FormControl, or via the `invalid` prop where a page does not
// use react-hook-form's FormControl) switches the outline to the destructive colour.
export const FIELD_BASE =
  "w-full rounded-lg border border-border bg-card font-sans text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:text-destructive aria-invalid:focus:border-destructive";

interface InputProps extends React.ComponentProps<"input"> {
  invalid?: boolean;
}

function Input({ className, invalid, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      aria-invalid={invalid || props["aria-invalid"]}
      className={cn(FIELD_BASE, "h-10 px-3.5", className)}
      {...props}
    />
  );
}

export { Input };
