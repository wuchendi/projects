'use client'

import { cn } from '@cdlab/ui/lib/utils'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { LinkRef } from '@/components/launchpad/launchpad-view'
import { LaunchpadView } from '@/components/launchpad/launchpad-view'
import type { LaunchpadConfig } from '@/database/schema'

// Mobile reference width the public renderer is laid out at before scaling.
const BASE_WIDTH = 390

interface PreviewProps {
  config: LaunchpadConfig
  linkRefs: Record<string, LinkRef>
  className?: string
}

// A live, scaled reuse of the public `LaunchpadView` (no screenshot pipeline) —
// renders the page at a fixed mobile width and scales it down to fit the
// container. Interaction is disabled so a preview click never navigates.
//
// `mode="thumb"` clips to a fixed-height window (list-card thumbnail).
// `mode="device"` reserves the full scaled height inside a scrollable phone
// frame (editor live preview).
export function LaunchpadPreview({
  config,
  linkRefs,
  mode,
  className,
}: PreviewProps & { mode: 'thumb' | 'device' }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [height, setHeight] = useState(0)
  // Device mode: page min-height (in base coords) so the theme background fills
  // the enclosing phone frame exactly — no black gap, no needless scrollbar.
  const [fillH, setFillH] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const measure = () => {
      const width = outer.clientWidth
      const s = width > 0 ? width / BASE_WIDTH : 0
      setScale(s)
      const frameH = outer.parentElement?.clientHeight ?? 0
      setFillH(mode === 'device' && s > 0 ? frameH / s : 0)
      setHeight(inner.scrollHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [mode])

  return (
    <div
      ref={outerRef}
      className={cn('relative overflow-hidden bg-background', className)}
    >
      {/* Reserve the scaled height so the device frame scrolls naturally. */}
      <div style={mode === 'device' ? { height: height * scale } : undefined}>
        <div
          ref={innerRef}
          className={cn(
            'pointer-events-none origin-top-left',
            // Device mode: fill the phone frame (via the measured --pv-fill min
            // height) so the theme background covers it, without overshooting
            // into a scrollbar. Thumb mode clips tight, so keep content-height.
            mode === 'device'
              ? '[&>main]:min-h-[var(--pv-fill)]'
              : '[&>main]:min-h-0',
          )}
          style={
            {
              width: BASE_WIDTH,
              transform: `scale(${scale})`,
              '--pv-fill': `${fillH}px`,
            } as CSSProperties
          }
        >
          <LaunchpadView config={config} linkRefs={linkRefs} bare />
        </div>
      </div>
    </div>
  )
}
