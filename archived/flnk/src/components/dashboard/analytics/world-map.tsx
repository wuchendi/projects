'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'
import { formatNumber } from '@/lib/format/format'
import { ALPHA2_TO_NUMERIC } from '@/lib/geo/iso-numeric'
import type { GeoPoint } from '@/lib/platform/api'

// Hover reuses a distinct accent fill so any country lights up under the cursor,
// regardless of its choropleth shade. v5 dropped the `{default, hover, pressed}`
// style object, so the hover state is a CSS rule instead — it outranks the SVG
// presentation attributes below without re-rendering every geography.
const GEOGRAPHY_CLASS =
  'outline-none hover:fill-[var(--accent)] hover:[fill-opacity:1]'

interface CountryMetric {
  name: string // ISO alpha-2 code (e.g. "US")
  count: number
}

// World map with two optional overlays:
//  - `countries`: a choropleth — each country shaded by its visit count.
//  - `points`: lat/lng bubbles sized by visit count.
// Pan + wheel-zoom via ZoomableGroup; hover a shaded country for a tooltip
// ("<country>: <visits>"), or a bubble for its count.
export function WorldMap({
  points = [],
  countries,
}: {
  points?: GeoPoint[]
  countries?: CountryMetric[]
}) {
  const t = useTranslations('analytics')
  const locale = useLocale()
  const max = points.reduce((m, p) => Math.max(m, p.count), 0) || 1
  const [position, setPosition] = useState({
    coordinates: [0, 0] as [number, number],
    zoom: 1,
  })

  // Country visit counts keyed by ISO numeric id (matches `geo.id`).
  const byNumeric = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of countries ?? []) {
      const num = ALPHA2_TO_NUMERIC[c.name]
      if (num) m.set(num, (m.get(num) ?? 0) + c.count)
    }
    return m
  }, [countries])
  const maxCountry = Math.max(1, ...byNumeric.values())

  return (
    <TooltipProvider>
      <div className="h-full w-full cursor-grab overflow-hidden active:cursor-grabbing">
        <ComposableMap
          projectionConfig={{ scale: 140 }}
          height={300}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            minZoom={1}
            maxZoom={8}
            onMoveEnd={({ coordinates, zoom }) =>
              setPosition((prev) => ({
                coordinates: coordinates ?? prev.coordinates,
                zoom: zoom ?? prev.zoom,
              }))
            }
          >
            <Geographies geography="/world-110m.json">
              {({ geographies }) =>
                geographies.map((geo) => {
                  const count = byNumeric.get(String(geo.id)) ?? 0
                  // Non-linear (sqrt) ramp so low-traffic countries still read.
                  const shade =
                    count > 0
                      ? {
                          fill: 'var(--primary)',
                          fillOpacity:
                            0.2 + 0.7 * Math.sqrt(count / maxCountry),
                        }
                      : { fill: 'var(--muted)' }
                  // Only shaded countries carry a tooltip; skip the empty ones
                  // so the map doesn't wire up hundreds of idle listeners.
                  if (count === 0) {
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        className={GEOGRAPHY_CLASS}
                        stroke="var(--background)"
                        {...shade}
                      />
                    )
                  }
                  return (
                    <Tooltip key={geo.rsmKey}>
                      <TooltipTrigger asChild>
                        <Geography
                          geography={geo}
                          className={GEOGRAPHY_CLASS}
                          stroke="var(--background)"
                          {...shade}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="font-medium">
                          {geo.properties?.name ?? geo.id}
                        </span>
                        : {formatNumber(count, locale)}
                      </TooltipContent>
                    </Tooltip>
                  )
                })
              }
            </Geographies>
            {points.map((p) => (
              <Marker key={`${p.lat},${p.lng}`} coordinates={[p.lng, p.lat]}>
                <circle
                  r={(2 + Math.sqrt(p.count / max) * 9) / position.zoom}
                  fill="var(--primary)"
                  fillOpacity={0.55}
                  stroke="var(--primary)"
                  strokeWidth={0.5 / position.zoom}
                >
                  <title>{`${p.count} ${t('counters.visits')}`}</title>
                </circle>
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </TooltipProvider>
  )
}
