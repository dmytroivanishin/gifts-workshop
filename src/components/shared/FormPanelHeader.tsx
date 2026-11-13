"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { BLOCK_HEADER_CLASS } from "@/utils/designTokens";

interface FormPanelHeaderProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  action?: ReactNode;
  headingLevel?: "h2" | "h3";
}

// Below lg the form sits above the list, so it starts folded to keep the list in view and opens on
// demand (or when a row is edited). From lg up the panel is always open and this toggle does nothing.
// The text styling sits on the button itself: browsers reset text-transform on buttons, which would
// otherwise drop the uppercase of BLOCK_HEADER_CLASS.
export function FormPanelHeader({ title, isOpen, onToggle, action, headingLevel = "h3" }: FormPanelHeaderProps) {
  const Heading = headingLevel;
  return (
    <div className="relative p-4 border-b border-border bg-muted/50 flex items-center justify-between">
      <Heading className="flex-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className={cn(
            BLOCK_HEADER_CLASS,
            "flex items-center gap-2 text-left lg:pointer-events-none lg:cursor-default"
          )}
        >
          {title}
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn("shrink-0 transition-transform duration-200 lg:hidden", isOpen && "rotate-180")}
          />
        </button>
      </Heading>
      {action}
    </div>
  );
}
