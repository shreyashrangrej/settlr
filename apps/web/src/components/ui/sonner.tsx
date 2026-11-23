'use client'

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Follows the `.dark` class on <html> (see src/lib/theme.ts) rather than
// next-themes. Toasts only render in the browser, so no hydration concerns.
function useDocumentTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light")
  useEffect(() => {
    const root = document.documentElement
    const update = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light")
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
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
          // Gr8r Studio's toast: inverted (the text colour as the fill),
          // 8px corners, 12.5px text and the long popover shadow.
          "--normal-bg": "var(--text)",
          "--normal-text": "var(--text-inv)",
          "--normal-border": "transparent",
          "--border-radius": "8px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !text-ui !shadow-[var(--shadow-pop)] !py-2.5 !pr-2.5 !pl-3",
          success: "[&_[data-icon]]:text-positive",
          error: "[&_[data-icon]]:text-destructive",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
