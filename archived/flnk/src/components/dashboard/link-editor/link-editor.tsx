'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@cdlab/ui/components/accordion'
import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Calendar } from '@cdlab/ui/components/calendar'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import { PasswordInput } from '@cdlab/ui/components/password-input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { Switch } from '@cdlab/ui/components/switch'
import { Textarea } from '@cdlab/ui/components/textarea'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarIcon, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CountrySelect } from '@/components/dashboard/link-editor/country-select'
import {
  buildPayload,
  geoRow,
  randomSlug,
  useLinkForm,
} from '@/components/dashboard/links/use-link-form'
import type { LinkRow } from '@/lib/platform/api'
import { configApi, linkApi, uploadApi } from '@/lib/platform/api'

export function LinkEditor({ existing }: { existing?: LinkRow }) {
  const t = useTranslations('links.form')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = !!existing

  const { form, setForm, set } = useLinkForm({ existing, withMaxVisits: true })
  const [aiPending, setAiPending] = useState(false)
  const [ogAiPending, setOgAiPending] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const r2Enabled = config?.r2 ?? false

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
      router.push('/dashboard/links')
    },
    onError: (e: Error) => toast.error(e.message),
  })

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

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {isEdit ? t('editTitle') : t('createTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

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
                className={`mr-1 size-3.5 ${aiPending ? 'animate-pulse' : ''}`}
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
        <TagsField value={form.tags} onChange={(v) => set('tags', v)} />
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
                      className={`w-full justify-start pr-9 font-normal ${expiryDate ? '' : 'text-muted-foreground'}`}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {expiryDate
                        ? expiryDate.toLocaleDateString(locale)
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
              <Label htmlFor="maxVisits">{t('maxVisits')}</Label>
              <Input
                id="maxVisits"
                type="number"
                min={1}
                value={form.maxVisits ?? ''}
                onChange={(e) =>
                  set(
                    'maxVisits',
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder={t('maxVisitsPlaceholder')}
              />
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
                    className={`mr-1 size-3.5 ${ogAiPending ? 'animate-pulse' : ''}`}
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

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/links')}
        >
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </form>
  )
}

const MAX_TAGS = 20
const MAX_TAG_LEN = 32

// Chip input: type a tag and press Enter (or comma) to add; click × to remove.
function TagsField({
  value,
  onChange,
}: {
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const t = useTranslations('links.form')
  const [draft, setDraft] = useState('')

  function add() {
    const tag = draft.trim().slice(0, MAX_TAG_LEN)
    if (!tag || value.includes(tag) || value.length >= MAX_TAGS) {
      setDraft('')
      return
    }
    onChange([...value, tag])
    setDraft('')
  }

  function remove(tag: string) {
    onChange(value.filter((x) => x !== tag))
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                aria-label={t('removeTag')}
                onClick={() => remove(tag)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder={t('addTag')}
        disabled={value.length >= MAX_TAGS}
      />
    </div>
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
