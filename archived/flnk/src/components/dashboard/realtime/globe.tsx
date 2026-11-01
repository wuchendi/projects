'use client'

import createGlobe from 'cobe'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import type { GeoPoint } from '@/lib/platform/api'

// Live-visit globe (cobe — tiny WebGL, no asset pipeline). Markers come from the
// aggregated `/api/logs/locations` feed; the globe auto-rotates. cobe v2 has no
// internal render loop, so we drive it from our own rAF and re-feed markers each
// frame (cheap: the point list is capped server-side).
export function RealtimeGlobe({ points }: { points: GeoPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest points without re-running the globe effect on every poll.
  const pointsRef = useRef<GeoPoint[]>(points)
  pointsRef.current = points

  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let width = canvas.offsetWidth || 400
    let phi = 0
    let raf = 0
    const onResize = () => {
      width = canvas.offsetWidth || width
    }
    window.addEventListener('resize', onResize)

    const toMarkers = (pts: GeoPoint[]) => {
      const max = pts.reduce((m, p) => Math.max(m, p.count), 0) || 1
      return pts.map((p) => ({
        location: [p.lat, p.lng] as [number, number],
        size: 0.02 + (p.count / max) * 0.08,
      }))
    }

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.25,
      dark: dark ? 1 : 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: dark ? 6 : 4,
      baseColor: dark ? [0.3, 0.3, 0.34] : [0.92, 0.92, 0.92],
      markerColor: [0.1, 0.8, 0.55],
      glowColor: dark ? [0.12, 0.14, 0.16] : [0.95, 0.95, 0.95],
      markers: toMarkers(pointsRef.current),
    })

    const frame = () => {
      globe.update({
        phi,
        width: width * 2,
        height: width * 2,
        markers: toMarkers(pointsRef.current),
      })
      phi += 0.003
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      globe.destroy()
    }
  }, [dark])

  return (
    <div className="mx-auto aspect-square w-full max-w-[420px]">
      <canvas
        ref={canvasRef}
        className="size-full"
        style={{ contain: 'layout paint size' }}
      />
    </div>
  )
}
