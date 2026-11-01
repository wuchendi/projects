import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Input } from '@cdlab/ui/components/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cdlab/ui/components/input-group'
import { Label } from '@cdlab/ui/components/label'
import { Slider } from '@cdlab/ui/components/slider'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import { cn } from '@cdlab/ui/lib/utils'
import type { User } from 'lucide-react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Background, LAYOUTS } from './constants'
import { BG_TYPES, bgPreview, DIRECTIONS, safeHex } from './constants'

export function SubSection({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof User
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{title}</h4>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}

// A selectable preview tile used by the block shape / fill / shadow pickers.
export function PickButton({
  active,
  ariaLabel,
  onClick,
  children,
}: {
  active: boolean
  ariaLabel: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-lg border p-3 transition-all hover:border-primary/60',
        active && 'border-primary ring-1 ring-primary/30',
      )}
    >
      {children}
    </button>
  )
}

export function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function Field({
  label,
  count,
  max,
  children,
}: {
  label: string
  count?: number
  max?: number
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {typeof count === 'number' && typeof max === 'number' && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {count}/{max}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// The solid / gradient / image selector — rendered in the section title row.
export function SurfaceTypeToggle({
  value,
  onChange,
}: {
  value: Background
  onChange: (patch: Partial<Background>) => void
}) {
  const t = useTranslations('launchpads')
  return (
    <ToggleGroup
      type="single"
      value={value.type}
      onValueChange={(v) => {
        if (!v) return
        if (v === 'gradient')
          onChange({ type: 'gradient', to: value.to ?? '#e0e7ff' })
        else if (v === 'image') onChange({ type: 'image' })
        else onChange({ type: 'solid' })
      }}
      variant="outline"
    >
      {BG_TYPES.map((tp) => (
        <ToggleGroupItem key={tp} value={tp} className="px-3 text-xs">
          {t(`design.background.${tp}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

// Shared body editor for a paintable surface (page background or header band):
// solid color, two-color gradient with a direction, or a cover image + overlay.
// The type selector lives in the section header (see `SurfaceTypeToggle`).
export function SurfaceEditor({
  value,
  onChange,
}: {
  value: Background
  onChange: (patch: Partial<Background>) => void
}) {
  const t = useTranslations('launchpads')
  return value.type === 'image' ? (
    <div className="space-y-4">
      <Field label={t('design.background.imageUrl')}>
        <Input
          value={value.image ?? ''}
          maxLength={2048}
          placeholder="https://…"
          onChange={(e) => onChange({ image: e.target.value })}
        />
      </Field>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('design.background.overlay')}</Label>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {value.overlay ?? 40}%
          </span>
        </div>
        <Slider
          value={[value.overlay ?? 40]}
          min={0}
          max={100}
          step={5}
          onValueChange={(vals) => onChange({ overlay: vals[0] ?? 40 })}
        />
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs">
          {value.type === 'gradient'
            ? t('design.background.from')
            : t('design.background.color')}
        </Label>
        <ColorInput
          value={value.from}
          onChange={(from) => onChange({ from })}
        />
      </div>
      {value.type === 'gradient' && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t('design.background.to')}</Label>
          <ColorInput
            value={value.to ?? '#e0e7ff'}
            onChange={(to) => onChange({ to })}
          />
        </div>
      )}
      {value.type === 'gradient' && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t('design.background.direction')}</Label>
          <div className="flex gap-1.5">
            {DIRECTIONS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={id}
                onClick={() => onChange({ dir: id })}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md border transition-colors hover:border-primary/60',
                  (value.dir ?? 'b') === id &&
                    'border-primary ring-1 ring-primary/30',
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      )}
      <span
        className="ml-auto h-10 w-16 shrink-0 rounded-md ring-1 ring-border"
        style={{ background: bgPreview(value) }}
      />
    </div>
  )
}

// A miniature mock of each header layout — pure CSS bars, no real content.
export function LayoutThumb({
  variant,
}: {
  variant: (typeof LAYOUTS)[number]
}) {
  if (variant === 'left') {
    return (
      <span className="flex h-14 w-full flex-col gap-1.5 rounded-md border bg-muted/40 p-2">
        <span className="flex items-center gap-1.5">
          <span className="size-3 shrink-0 rounded-full bg-muted-foreground/40" />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="h-1 w-8 rounded bg-muted-foreground/40" />
            <span className="h-1 w-5 rounded bg-muted-foreground/25" />
          </span>
        </span>
        <span className="h-2 w-full rounded bg-muted-foreground/15" />
        <span className="h-2 w-full rounded bg-muted-foreground/15" />
      </span>
    )
  }
  if (variant === 'hero') {
    return (
      <span className="flex h-14 w-full flex-col items-center overflow-hidden rounded-md border bg-muted/40">
        <span className="h-4 w-full bg-primary/40" />
        <span className="-mt-2 size-3 rounded-full bg-muted-foreground/50 ring-2 ring-background" />
        <span className="mt-0.5 h-1 w-8 rounded bg-muted-foreground/40" />
        <span className="mt-1 h-2 w-4/5 rounded bg-muted-foreground/15" />
      </span>
    )
  }
  if (variant === 'banner') {
    return (
      <span className="flex h-14 w-full flex-col overflow-hidden rounded-md border bg-muted/40">
        <span className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-primary/40">
          <span className="size-3 rounded-full bg-background/70" />
          <span className="h-1 w-8 rounded bg-background/70" />
        </span>
        <span className="flex flex-col gap-1 p-1.5">
          <span className="h-2 w-full rounded bg-muted-foreground/15" />
        </span>
      </span>
    )
  }
  if (variant === 'cover') {
    return (
      <span className="flex h-14 w-full flex-col items-center gap-1 rounded-md border bg-muted/40 p-2">
        <span className="size-6 rounded-md bg-muted-foreground/40" />
        <span className="h-1 w-8 rounded bg-muted-foreground/40" />
        <span className="mt-0.5 h-2 w-full rounded bg-muted-foreground/15" />
      </span>
    )
  }
  if (variant === 'compact') {
    return (
      <span className="flex h-14 w-full flex-col items-center gap-1 rounded-md border bg-muted/40 p-2">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-muted-foreground/40" />
          <span className="h-1 w-7 rounded bg-muted-foreground/40" />
        </span>
        <span className="mt-1 h-2 w-full rounded bg-muted-foreground/15" />
        <span className="h-2 w-full rounded bg-muted-foreground/15" />
      </span>
    )
  }
  return (
    <span className="flex h-14 w-full flex-col items-center gap-1 rounded-md border bg-muted/40 p-2">
      <span className="size-3 rounded-full bg-muted-foreground/40" />
      <span className="h-1 w-8 rounded bg-muted-foreground/40" />
      <span className="mt-1 h-2 w-full rounded bg-muted-foreground/15" />
      <span className="h-2 w-full rounded bg-muted-foreground/15" />
    </span>
  )
}

// A color override that can be cleared back to "auto" (auto-contrast). Unset →
// a button that seeds a starting color; set → a picker plus a reset control.
export function OptionalColor({
  value,
  onChange,
  autoLabel,
}: {
  value?: string
  onChange: (value?: string) => void
  autoLabel: string
}) {
  if (!value) {
    return (
      <Button variant="outline" size="sm" onClick={() => onChange('#111111')}>
        {autoLabel}
      </Button>
    )
  }
  return (
    <ColorInput
      value={value}
      onChange={onChange}
      trailing={
        <InputGroupButton
          size="icon-xs"
          aria-label={autoLabel}
          onClick={() => onChange(undefined)}
        >
          <X />
        </InputGroupButton>
      }
    />
  )
}

// Color picker swatch + hex text input, kept in sync. The native picker needs a
// full 7-char hex, so it falls back while the text field is mid-edit.
export function ColorInput({
  value,
  onChange,
  trailing,
}: {
  value: string
  onChange: (value: string) => void
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border">
        <span
          className="block size-full"
          style={{ backgroundColor: safeHex(value, '#ffffff') }}
        />
        <input
          type="color"
          value={safeHex(value, '#000000')}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={value}
        />
      </label>
      <InputGroup className="w-28">
        <InputGroupInput
          value={value}
          maxLength={7}
          className="font-mono text-xs"
          onChange={(e) => onChange(e.target.value)}
        />
        {trailing && (
          <InputGroupAddon align="inline-end">{trailing}</InputGroupAddon>
        )}
      </InputGroup>
    </div>
  )
}
