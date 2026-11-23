"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "#/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list relative isolate inline-flex w-fit items-center justify-center gap-0.5 rounded-lg p-0.5 text-muted-foreground group-data-horizontal/tabs:h-8 sm:group-data-horizontal/tabs:h-6.5 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-raised",
        line: "gap-0.5 border-b bg-transparent group-data-horizontal/tabs:h-9 sm:group-data-horizontal/tabs:h-9",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      {/* The active tab's fill (or underline) is one element that slides
          to the tab you pick, rather than each tab drawing its own. Base UI
          measures the active tab into the --active-tab-* variables; it
          renders before hydration so a server-rendered page doesn't show
          the tabs without it. */}
      <TabsPrimitive.Indicator
        data-slot="tabs-indicator"
        renderBeforeHydration
        className={cn(
          "absolute top-0 left-0 -z-1 translate-x-(--active-tab-left) translate-y-(--active-tab-top) transition-[translate,width,height] duration-250 ease-out-quint",
          variant === "line"
            ? "top-auto bottom-[-1px] h-0.5 w-[calc(var(--active-tab-width)-1rem)] translate-x-[calc(var(--active-tab-left)+0.5rem)] translate-y-0 rounded-full bg-foreground group-data-vertical/tabs:hidden"
            : "h-(--active-tab-height) w-(--active-tab-width) rounded-md bg-segment shadow-[0_1px_2px_rgb(0_0_0/8%),0_0_0_1px_var(--border)]"
        )}
      />
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-0 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-140 hover:text-foreground sm:px-[9px] sm:text-xs group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-2.5 group-data-[variant=line]/tabs-list:sm:text-ui group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
