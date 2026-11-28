"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "@cdlab/ui/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props) {
  const viewportRef = React.useRef<HTMLDivElement>(null)

  // Base UI re-measures the scrollbar only when the viewport itself resizes or
  // scrolls, so content that grows or shrinks inside a fixed viewport (e.g. a
  // client-side navigation in the app shell) left a stale thumb behind. Watch
  // the viewport's children and replay a scroll event so it re-measures.
  React.useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === "undefined") return
    const resizeObserver = new ResizeObserver(() =>
      viewport.dispatchEvent(new Event("scroll"))
    )
    const observeChildren = () => {
      resizeObserver.disconnect()
      for (const child of viewport.children) resizeObserver.observe(child)
    }
    observeChildren()
    const mutationObserver = new MutationObserver(observeChildren)
    mutationObserver.observe(viewport, { childList: true })
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
