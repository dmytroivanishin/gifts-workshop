"use client"

import * as React from "react"

import { cn } from "@/utils/cn"

// The native colour picker as a rounded square. The only colour picker in the admin, so the
// colours page and the category form always look the same.
function ColorPicker({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="color"
      data-slot="color-picker"
      className={cn(
        "size-9 sm:size-10 shrink-0 cursor-pointer rounded-[9px] border border-border bg-card p-1.5 transition-colors outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
        "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[6px] [&::-webkit-color-swatch]:border-0",
        "[&::-moz-color-swatch]:rounded-[6px] [&::-moz-color-swatch]:border-0",
        className
      )}
      {...props}
    />
  )
}

export { ColorPicker }
