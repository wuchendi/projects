'use client'

import { Badge } from '@cdlab/ui/components/badge'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldTitle,
} from '@cdlab/ui/components/field'
import { Slider } from '@cdlab/ui/components/slider'
import { Switch } from '@cdlab/ui/components/switch'
import type { HlsLogEntry } from '@/hooks/use-hls-player'

export function SliderField({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <Field orientation="vertical">
      <div className="flex justify-between">
        <FieldTitle>{label}</FieldTitle>
        <span className="text-muted-foreground text-sm tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </Field>
  )
}

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldTitle>{label}</FieldTitle>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  )
}

export function LogBadge({ type }: { type: HlsLogEntry['type'] }) {
  const variant =
    type === 'error' ? 'destructive' : type === 'warn' ? 'outline' : 'secondary'
  return (
    <Badge variant={variant} className="text-[10px] px-1 py-0 font-mono">
      {type.toUpperCase()}
    </Badge>
  )
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatBitrate(bitrate: number): string {
  if (bitrate >= 1_000_000) return `${(bitrate / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(bitrate / 1000)} Kbps`
}
