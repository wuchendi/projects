'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import type { QRCodeHandle } from '@cdlab/ui/components/qr-code'
import { QRCode } from '@cdlab/ui/components/qr-code'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import type { LinkConfig } from '@/database/schema'

// QR encodes the link's `?qr=1` URL so a scan is distinguishable from a click
// (the redirect engine records source=qr and strips the marker).
function scanUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}qr=1`
}

export function QrPopover({
  url,
  slug,
  qr,
  children,
}: {
  url: string
  slug: string
  qr?: LinkConfig['qr']
  children: ReactNode
}) {
  const t = useTranslations('links')
  const canvasRef = useRef<QRCodeHandle>(null)
  const svgRef = useRef<QRCodeHandle>(null)

  // Saved style, falling back to a fixed black-on-white + quiet zone so the
  // code scans regardless of theme and the export looks right.
  const style = {
    fgColor: qr?.fgColor ?? '#0f172a',
    bgColor: qr?.bgColor ?? '#ffffff',
    dotType: qr?.dotStyle ?? 'dot',
    finderType: qr?.cornerStyle ?? 'rounded',
    errorLevel: qr?.errorLevel ?? 'M',
    marginSize: qr?.margin ?? 2,
    icon: qr?.logo || undefined,
  } as const

  const value = scanUrl(url)

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-56 break-all text-center text-xs text-muted-foreground">
            {url}
          </p>
          <QRCode
            ref={canvasRef}
            value={value}
            type="canvas"
            size={224}
            {...style}
            bordered
          />
          {/* Hidden SVG render of the same code, kept only so SVG export works
              without a second visible widget. */}
          <div className="hidden">
            <QRCode
              ref={svgRef}
              value={value}
              type="svg"
              size={224}
              {...style}
            />
          </div>
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => canvasRef.current?.download(`${slug}.png`)}
            >
              <Download className="mr-2 size-4" />
              {t('qr.downloadPng')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => svgRef.current?.download(`${slug}.svg`)}
            >
              <Download className="mr-2 size-4" />
              {t('qr.downloadSvg')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
