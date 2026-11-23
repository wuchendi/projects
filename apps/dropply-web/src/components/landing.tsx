'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@cdlab/ui/components/accordion'
import { cn } from '@cdlab/ui/lib/utils'
import { EyeOff, KeyRound, Lock, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

type Cell = true | null

// Tetris-like falling grid. Cells drop one row per tick and fade in/out; a full
// bottom row clears. Decorative only.
function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(0)
  const [dims, setDims] = useState({ rows: 0, cols: 0 })
  const [grid, setGrid] = useState<Cell[][]>([])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (!width || !height) return
      const base = Math.ceil(width / 30)
      const cell = width / base
      const rows = Math.ceil(height / cell)
      setCellSize(cell)
      setDims({ rows, cols: base })
      setGrid(
        Array.from({ length: rows + 1 }, () =>
          Array.from<Cell>({ length: base }).fill(null),
        ),
      )
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const { rows, cols } = dims
    if (!rows || !cols) return
    const timeouts = new Set<ReturnType<typeof setTimeout>>()
    const id = setInterval(() => {
      setGrid((prev) => {
        if (prev.length <= rows) return prev
        const next = prev.map((row) => row.slice())
        for (let row = rows - 1; row >= 0; row--) {
          for (let col = 0; col < cols; col++) {
            if (next[row][col] !== null && next[row + 1][col] === null) {
              next[row + 1][col] = next[row][col]
              next[row][col] = null
            }
          }
        }
        next[0][Math.floor(Math.random() * cols)] = true
        return next
      })
      const timeout = setTimeout(() => {
        timeouts.delete(timeout)
        setGrid((prev) => {
          if (prev.length <= rows || !prev[rows].every((cell) => cell !== null))
            return prev
          const next = prev.map((row) => row.slice())
          next[rows] = Array.from<Cell>({ length: cols }).fill(null)
          return next
        })
      }, 500)
      timeouts.add(timeout)
    }, 1000)
    return () => {
      clearInterval(id)
      timeouts.forEach(clearTimeout)
    }
  }, [dims])

  const mask = 'linear-gradient(to bottom, #000 0%, #000 62%, transparent 100%)'

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        ref={ref}
        className="absolute inset-0 grid justify-center -space-y-px"
        style={{
          gridAutoRows: cellSize ? `${cellSize}px` : undefined,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {grid.map((row, rowIndex) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: grid is positional
            key={rowIndex}
            className="grid grid-flow-col -space-x-px"
            style={{ gridAutoColumns: `${cellSize}px` }}
          >
            {row.map((cell, cellIndex) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: grid is positional
                key={cellIndex}
                className="relative border border-foreground/[0.06]"
              >
                <div
                  className={cn(
                    'absolute inset-0 bg-foreground/[0.07] opacity-0 transition-opacity duration-1000 will-change-[opacity]',
                    cell && 'opacity-100',
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Hero({ children }: { children: ReactNode }) {
  const t = useTranslations('landing.hero')

  return (
    <section className="relative isolate -mt-14 overflow-hidden px-4 pt-24 pb-16 sm:pt-28">
      <HeroBackground />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="relative flex size-2">
            <span
              className="absolute inline-flex size-full rounded-full bg-foreground/40"
              style={{ animation: 'hero-pulse-ring 2.4s ease-out infinite' }}
            />
            <span className="relative inline-flex size-2 rounded-full bg-foreground" />
          </span>
          {t('badge')}
        </span>

        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-foreground">{t('titleLead')} </span>
          <span className="hero-shine-text">{t('titleHighlight')}</span>
        </h1>

        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t('subtitle')}
        </p>

        <p className="text-xs text-muted-foreground">{t('trust')}</p>
      </div>

      <div className="mt-14 w-full">{children}</div>
    </section>
  )
}

function CardCorners() {
  const base =
    'pointer-events-none absolute size-2.5 border-foreground/20 transition-colors group-hover:border-foreground/40'
  return (
    <>
      <span className={cn(base, 'left-0 top-0 border-l border-t')} />
      <span className={cn(base, 'right-0 top-0 border-r border-t')} />
      <span className={cn(base, 'bottom-0 left-0 border-b border-l')} />
      <span className={cn(base, 'bottom-0 right-0 border-b border-r')} />
    </>
  )
}

const FEATURES = [
  { key: 'local', Icon: Lock },
  { key: 'keys', Icon: KeyRound },
  { key: 'share', Icon: Share2 },
  { key: 'private', Icon: EyeOff },
] as const

export function Features() {
  const t = useTranslations('landing.features')

  return (
    <section className="w-full">
      <div className="mb-8 max-w-xl">
        <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          {t('title')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ key, Icon }) => (
          <div
            key={key}
            className="group relative flex min-h-44 flex-col justify-between gap-8 border border-border/50 bg-gradient-to-b from-muted/30 to-transparent p-5 transition-colors hover:border-border"
          >
            <CardCorners />
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background/60">
              <Icon className="size-5 text-foreground" />
            </span>
            <div className="space-y-1.5">
              <dt className="font-semibold text-foreground">
                {t(`items.${key}.title`)}
              </dt>
              <dd className="text-sm leading-snug text-muted-foreground">
                {t(`items.${key}.desc`)}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}

const FAQ = [
  'create',
  'encryptFile',
  'decryptFile',
  'encryptText',
  'share',
  'uploaded',
  'canRead',
  'forgotPin',
] as const

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks')

  return (
    <section
      id="how-it-works"
      className="grid w-full scroll-mt-24 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] md:gap-12"
    >
      <div className="md:sticky md:top-24 md:self-start">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {t('title')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>
      <Accordion>
        {FAQ.map((key) => (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger>{t(`faq.${key}.q`)}</AccordionTrigger>
            <AccordionContent>{t(`faq.${key}.a`)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
