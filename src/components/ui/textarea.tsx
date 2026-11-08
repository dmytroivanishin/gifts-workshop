import * as React from "react";

import { cn } from "@/utils/cn";
import { FIELD_BASE } from "@/components/ui/input";

interface TextareaProps extends React.ComponentProps<"textarea"> {
  invalid?: boolean;
}

function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      aria-invalid={invalid || props["aria-invalid"]}
      className={cn(FIELD_BASE, "min-h-[80px] px-3.5 py-2.5 resize-none", className)}
      {...props}
    />
  );
}

export { Textarea };
