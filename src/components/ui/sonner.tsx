"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps, toast } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          
          // Soft Success (Lime theme matching your tokens)
          "--success-bg": "#F5F6F2", // Lime 100
          "--success-text": "#494F2B", // Lime 700
          "--success-border": "#DADFC6", // Lime 300
          
          // Soft Error (Rose theme matching your tokens)
          "--error-bg": "#F8F4F4", // Rose 100
          "--error-text": "#703C3C", // Rose 700
          "--error-border": "#E8D5D5", // Rose 300
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast border shadow-sm font-sans rounded-2xl",
          success: "!bg-[#F5F6F2] !text-[#494F2B] !border-[#DADFC6] [&_svg]:!text-[#7D8945]",
          error: "!bg-[#F8F4F4] !text-[#703C3C] !border-[#E8D5D5] [&_svg]:!text-[#B87070]",
          warning: "!bg-[#FDF8F2] !text-[#805B36] !border-[#F5E6D3] [&_svg]:!text-[#D9822B]",
          info: "!bg-[#F4F7F6] !text-[#2F524A] !border-[#D1E0DD] [&_svg]:!text-[#3B7A6E]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
