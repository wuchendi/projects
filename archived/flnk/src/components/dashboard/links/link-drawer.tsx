'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@cdlab/ui/components/accordion'
import { Button } from '@cdlab/ui/components/button'
import { Calendar } from '@cdlab/ui/components/calendar'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@cdlab/ui/components/drawer'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import { PasswordInput } from '@cdlab/ui/components/password-input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { QRCode } from '@cdlab/ui/components/qr-code'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Switch } from '@cdlab/ui/components/switch'
import { Textarea } from '@cdlab/ui/components/textarea'
import { cn } from '@cdlab/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarIcon, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CountrySelect } from '@/components/dashboard/links/country-select'
import { TagCombobox } from '@/components/dashboard/links/tag-combobox'
import type {
  QrCorner,
  QrDot,
  QrErrorLevel,
} from '@/components/dashboard/links/use-link-form'
import {
  buildPayload,
  geoRow,
  randomSlug,
  useLinkForm,
} from '@/components/dashboard/links/use-link-form'
import { buildShortUrl, dateLocale } from '@/lib/format/format'
import type { LinkRow } from '@/lib/platform/api'
import { configApi, linkApi, uploadApi } from '@/lib/platform/api'
import { queryKeys } from '@/lib/platform/query-keys'

// Inline create/edit surface: a right-side panel on desktop, full-screen on
// small screens. Keeps the user on the links list instead of navigating away.
export function LinkDrawer({
  open,
  existing,
  onOpenChange,
}: {
  open: boolean
  existing?: LinkRow
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('links.form')
  const tc = useTranslations('common')
  const [saving, setSaving] = useState(false)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {existing ? t('editTitle') : t('createTitle')}
          </DrawerTitle>
          <DrawerDescription>{t('subtitle')}</DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            <EditorForm
              key={existing?.id ?? 'new'}
              existing={existing}
              onDone={() => onOpenChange(false)}
              onSavingChange={setSaving}
            />
          </div>
        </ScrollArea>

        <DrawerFooter className="flex-row justify-end gap-2">
          <DrawerClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              {tc('cancel')}
            </Button>
          </DrawerClose>
          <Button type="submit" form="link-editor-form" disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// The form body. Submits via `form="link-editor-form"` from the drawer footer;
// reports its in-flight state through `onSavingChange` so the footer can drive
// the submit button. Keyed by target in the host so state resets per open.
function EditorForm({
  existing,
  onDone,
  onSavingChange,
}: {
  existing?: LinkRow
  onDone: () => void
  onSavingChange: (saving: boolean) => void
}) {
  const t = useTranslations('links.form')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const isEdit = !!existing

  const { form, setForm, set } = useLinkForm({
    existing,
    withTitle: true,
    withQr: true,
    defaultExpiry: true,
  })
  const [aiPending, setAiPending] = useState(false)
  const [ogAiPending, setOgAiPending] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const r2Enabled = config?.r2 ?? false

  // Existing tags, to suggest in the chip input (typing convenience only).
  const { data: tagsData } = useQuery({
    queryKey: ['link-tags'],
    queryFn: () => linkApi.tags(),
  })
  const tagSuggestions = tagsData?.tags.map((x) => x.tag) ?? []

  const save = useMutation({
    mutationFn: () => {
      const payload = buildPayload(form)
      return isEdit
        ? linkApi.edit({ ...payload, id: existing!.id })
        : linkApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? t('updated') : t('created'))
      void queryClient.invalidateQueries({ queryKey: ['links'] })
      void queryClient.invalidateQueries({ queryKey: ['link-tags'] })
      // Creating a link changes the total count and the overview/analytics
      // stats — invalidate those key groups by prefix so every window drops.
      void queryClient.invalidateQueries({ queryKey: queryKeys.linkCount() })
      void queryClient.invalidateQueries({ queryKey: ['stats', 'counters'] })
      void queryClient.invalidateQueries({ queryKey: ['stats', 'metrics'] })
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  useEffect(() => {
    onSavingChange(save.isPending)
  }, [save.isPending, onSavingChange])

  async function generateSlug() {
    if (!form.url.trim()) {
      toast.error(t('urlRequired'))
      return
    }
    setAiPending(true)
    try {
      const { slug } = await linkApi.aiSlug(form.url.trim())
      set('slug', slug)
    } catch {
      toast.error(t('aiFailed'))
    } finally {
      setAiPending(false)
    }
  }

  async function generateOg() {
    if (!form.url.trim()) {
      toast.error(t('urlRequired'))
      return
    }
    setOgAiPending(true)
    try {
      const { title, description } = await linkApi.aiOg(form.url.trim(), locale)
      setForm((s) => ({ ...s, title, description }))
    } catch {
      toast.error(t('aiFailed'))
    } finally {
      setOgAiPending(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.url.trim()) {
      toast.error(t('urlRequired'))
      return
    }
    save.mutate()
  }

  const expiryDate = form.expiresAt ? new Date(form.expiresAt) : undefined
  const qrPreviewUrl = buildShortUrl(
    form.slug.trim() || 'example',
    existing?.domain ?? '',
  )

  return (
    <form
      id="link-editor-form"
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="url">{t('url')}</Label>
        <Input
          id="url"
          value={form.url}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://example.com/very/long/url"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="slug">{t('slug')}</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set('slug', randomSlug())}
            >
              {t('random')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={aiPending}
              onClick={generateSlug}
            >
              <Sparkles
                className={cn('mr-1 size-3.5', aiPending && 'animate-pulse')}
              />
              {t('aiSlug')}
            </Button>
          </div>
        </div>
        <Input
          id="slug"
          value={form.slug}
          onChange={(e) => set('slug', e.target.value)}
          placeholder={t('slugPlaceholder')}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayTitle">{t('title')}</Label>
        <Input
          id="displayTitle"
          value={form.displayTitle}
          onChange={(e) => set('displayTitle', e.target.value)}
          placeholder={t('titlePlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment">{t('comment')}</Label>
        <Input
          id="comment"
          value={form.comment}
          onChange={(e) => set('comment', e.target.value)}
          placeholder={t('commentPlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('tags')}</Label>
        <TagCombobox
          value={form.tags}
          onChange={(v) => set('tags', v)}
          suggestions={tagSuggestions}
        />
      </div>

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="link_settings">
          <AccordionTrigger>{t('section.settings')}</AccordionTrigger>
          <AccordionContent className="space-y-4 px-1">
            <SwitchField
              label={t('redirectWithQuery')}
              checked={form.redirectWithQuery}
              onChange={(v) => set('redirectWithQuery', v)}
            />
            <SwitchField
              label={t('cloaking')}
              checked={form.cloaking}
              onChange={(v) => set('cloaking', v)}
            />
            <SwitchField
              label={t('unsafe')}
              checked={form.unsafe}
              onChange={(v) => set('unsafe', v)}
            />
            <div className="space-y-2">
              <Label>{t('expiration')}</Label>
              <div className="relative">
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full justify-start pr-9 font-normal',
                        !expiryDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {expiryDate
                        ? format(expiryDate, 'PP', {
                            locale: dateLocale(locale),
                          })
                        : t('pickDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiryDate}
                      defaultMonth={expiryDate}
                      disabled={{ before: new Date() }}
                      onSelect={(d?: Date) => {
                        set('expiresAt', d ? d.getTime() : null)
                        if (d) setDateOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {expiryDate && (
                  <button
                    type="button"
                    aria-label={t('clearDate')}
                    onClick={() => set('expiresAt', null)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <PasswordInput
                id="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={
                  isEdit ? t('passwordKeep') : t('passwordPlaceholder')
                }
                autoComplete="new-password"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="og">
          <AccordionTrigger>{t('section.og')}</AccordionTrigger>
          <AccordionContent className="space-y-4 px-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title">{t('ogTitle')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={ogAiPending}
                  onClick={generateOg}
                >
                  <Sparkles
                    className={cn(
                      'mr-1 size-3.5',
                      ogAiPending && 'animate-pulse',
                    )}
                  />
                  {t('aiOg')}
                </Button>
              </div>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('ogDescription')}</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">{t('ogImage')}</Label>
              <Input
                id="image"
                value={form.image}
                onChange={(e) => set('image', e.target.value)}
                placeholder="https://…"
              />
              {r2Enabled && (
                <ImageUploader
                  slug={form.slug}
                  onUploaded={(url) => set('image', url)}
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="qr">
          <AccordionTrigger>{t('section.qr')}</AccordionTrigger>
          <AccordionContent className="space-y-4 px-1">
            <div className="flex justify-center">
              <QRCode
                value={qrPreviewUrl}
                type="canvas"
                size={160}
                fgColor={form.qrFg}
                bgColor={form.qrBg}
                dotType={form.qrDot}
                finderType={form.qrCorner}
                errorLevel={form.qrError}
                marginSize={form.qrMargin}
                icon={form.qrLogo || undefined}
                bordered
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                label={t('qrFg')}
                value={form.qrFg}
                onChange={(v) => set('qrFg', v)}
              />
              <ColorField
                label={t('qrBg')}
                value={form.qrBg}
                onChange={(v) => set('qrBg', v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('qrDot')}</Label>
                <Select
                  value={form.qrDot}
                  onValueChange={(v) => set('qrDot', v as QrDot)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dot">{t('qrDotRound')}</SelectItem>
                    <SelectItem value="square">{t('qrDotSquare')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('qrCorner')}</Label>
                <Select
                  value={form.qrCorner}
                  onValueChange={(v) => set('qrCorner', v as QrCorner)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rounded">
                      {t('qrCornerRound')}
                    </SelectItem>
                    <SelectItem value="square">
                      {t('qrCornerSquare')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('qrErrorLevel')}</Label>
                <Select
                  value={form.qrError}
                  onValueChange={(v) => set('qrError', v as QrErrorLevel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L (7%)</SelectItem>
                    <SelectItem value="M">M (15%)</SelectItem>
                    <SelectItem value="Q">Q (25%)</SelectItem>
                    <SelectItem value="H">H (30%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr-margin">{t('qrMargin')}</Label>
                <Input
                  id="qr-margin"
                  type="number"
                  min={0}
                  max={16}
                  value={form.qrMargin}
                  onChange={(e) =>
                    set(
                      'qrMargin',
                      Math.max(0, Math.min(16, Number(e.target.value) || 0)),
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-logo">{t('qrLogo')}</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-logo"
                  value={form.qrLogo}
                  onChange={(e) => set('qrLogo', e.target.value)}
                  placeholder={r2Enabled ? t('qrLogoUploaded') : 'https://…'}
                  disabled={r2Enabled}
                />
                {form.qrLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('qrLogoClear')}
                    onClick={() => set('qrLogo', '')}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
              {r2Enabled && (
                <ImageUploader
                  slug={form.slug}
                  onUploaded={(url) => set('qrLogo', url)}
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="device">
          <AccordionTrigger>{t('section.device')}</AccordionTrigger>
          <AccordionContent className="space-y-4 px-1">
            <div className="space-y-2">
              <Label htmlFor="google">{t('googlePlay')}</Label>
              <Input
                id="google"
                value={form.google}
                onChange={(e) => set('google', e.target.value)}
                placeholder="https://play.google.com/store/apps/…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apple">{t('appStore')}</Label>
              <Input
                id="apple"
                value={form.apple}
                onChange={(e) => set('apple', e.target.value)}
                placeholder="https://apps.apple.com/app/…"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="geo">
          <AccordionTrigger>{t('section.geo')}</AccordionTrigger>
          <AccordionContent className="space-y-2 px-1">
            {form.geo.map((row) => (
              <div key={row.id} className="flex gap-2">
                <div className="w-28 shrink-0">
                  <CountrySelect
                    value={row.country}
                    placeholder={t('selectCountry')}
                    onChange={(code) =>
                      set(
                        'geo',
                        form.geo.map((g) =>
                          g.id === row.id ? { ...g, country: code } : g,
                        ),
                      )
                    }
                  />
                </div>
                <Input
                  value={row.url}
                  placeholder="https://…"
                  className="flex-1"
                  onChange={(e) =>
                    set(
                      'geo',
                      form.geo.map((g) =>
                        g.id === row.id ? { ...g, url: e.target.value } : g,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    set(
                      'geo',
                      form.geo.filter((g) => g.id !== row.id),
                    )
                  }
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set('geo', [...form.geo, geoRow()])}
            >
              <Plus className="mr-1 size-4" />
              {t('addGeo')}
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="utm">
          <AccordionTrigger>{t('section.utm')}</AccordionTrigger>
          <AccordionContent className="px-1">
            <UtmBuilder
              onApply={(url) => set('url', url)}
              getUrl={() => form.url}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </form>
  )
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// Native color swatch paired with a hex text input. The swatch always yields a
// valid `#rrggbb`; the text input lets the user type/paste a hex.
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
      </div>
    </div>
  )
}

// Shown only when R2 is configured — uploads an image and sets the OG image URL.
function ImageUploader({
  slug,
  onUploaded,
}: {
  slug: string
  onUploaded: (url: string) => void
}) {
  const t = useTranslations('links.form')
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: (file: File) => uploadApi.image(file, slug),
    onSuccess: (r) => {
      onUploaded(r.url)
      toast.success(t('imageUploaded'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload.mutate(file)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={upload.isPending}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mr-2 size-3.5" />
        {upload.isPending ? t('imageUploading') : t('imageUpload')}
      </Button>
    </>
  )
}

const UTM_FIELDS = ['source', 'medium', 'campaign', 'term', 'content'] as const

// Appends utm_* params to the current destination URL.
function UtmBuilder({
  getUrl,
  onApply,
}: {
  getUrl: () => string
  onApply: (url: string) => void
}) {
  const t = useTranslations('links.form')
  const [utm, setUtm] = useState<Record<string, string>>({})

  function apply() {
    const base = getUrl().trim()
    if (!base) {
      toast.error(t('urlRequired'))
      return
    }
    try {
      const u = new URL(base)
      for (const key of UTM_FIELDS) {
        const value = (utm[key] ?? '').trim()
        if (value) u.searchParams.set(`utm_${key}`, value)
      }
      onApply(u.toString())
      toast.success(t('utmApplied'))
    } catch {
      toast.error(t('urlInvalid'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {UTM_FIELDS.map((key) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`utm-${key}`} className="text-xs">
              {t(`utm.${key}`)}
            </Label>
            <Input
              id={`utm-${key}`}
              value={utm[key] ?? ''}
              onChange={(e) => setUtm((s) => ({ ...s, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={apply}>
        {t('utmApply')}
      </Button>
    </div>
  )
}
