'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Input } from '@cdlab/ui/components/input'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cdlab/ui/components/tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Save, Send, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BuildTab } from '@/components/dashboard/launchpads/build-tab'
import { DesignTab } from '@/components/dashboard/launchpads/design-tab'
import { LaunchpadEditorSkeleton } from '@/components/dashboard/launchpads/launchpad-editor-skeleton'
import { LaunchpadPreview } from '@/components/dashboard/launchpads/launchpad-preview'
import { TrackTab } from '@/components/dashboard/launchpads/track-tab'
import type { LaunchpadConfig, LaunchpadStatus } from '@/database/schema'
import { DEFAULT_LAUNCHPAD_CONFIG } from '@/database/schema'
import { buildLaunchpadUrl } from '@/lib/format/format'
import type { LaunchpadRow } from '@/lib/platform/api'
import { launchpadApi } from '@/lib/platform/api'
import { useAllLinks, useLinkRefs } from './use-link-refs'

interface EditorState {
  title: string
  slug: string
  status: LaunchpadStatus
  config: LaunchpadConfig
}

function stateOf(row: LaunchpadRow): EditorState {
  return {
    title: row.title,
    slug: row.slug,
    status: row.status,
    config: row.config,
  }
}

export function LaunchpadEditor({ id }: { id: string }) {
  const t = useTranslations('launchpads')
  const tc = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [currentId, setCurrentId] = useState<string | null>(isNew ? null : id)
  const [form, setForm] = useState<EditorState>({
    title: '',
    slug: '',
    status: 'draft',
    config: DEFAULT_LAUNCHPAD_CONFIG,
  })
  // JSON of the last persisted state — drives the unsaved-changes indicator.
  const snapshot = useRef<string>(isNew ? '' : '__loading__')
  const loaded = useRef(isNew)

  const existing = useQuery({
    queryKey: ['launchpad', id],
    enabled: !isNew,
    queryFn: () => launchpadApi.get(id),
  })

  // Seed local state once from the loaded row (edit mode).
  useEffect(() => {
    if (loaded.current || !existing.data) return
    const next = stateOf(existing.data.launchpad)
    setForm(next)
    snapshot.current = JSON.stringify(next)
    loaded.current = true
  }, [existing.data])

  // Links for the block pickers + preview reference resolution.
  const linksQuery = useAllLinks()
  const links = linksQuery.data?.links ?? []
  const linkRefs = useLinkRefs()

  const dirty = JSON.stringify(form) !== snapshot.current

  const save = useMutation({
    mutationFn: async (status: LaunchpadStatus) => {
      const payload = {
        slug: form.slug.trim() || undefined,
        title: form.title.trim(),
        status,
        config: form.config,
      }
      const result = currentId
        ? await launchpadApi.edit({ id: currentId, ...payload })
        : await launchpadApi.create(payload)
      return result.launchpad
    },
    onSuccess: (row) => {
      const next = stateOf(row)
      setForm(next)
      snapshot.current = JSON.stringify(next)
      if (!currentId) {
        setCurrentId(row.id)
        loaded.current = true
        window.history.replaceState(null, '', `/dashboard/launchpads/${row.id}`)
      }
      void queryClient.invalidateQueries({ queryKey: ['launchpads'] })
      void queryClient.invalidateQueries({ queryKey: ['launchpad', row.id] })
      toast.success(
        row.status === 'published' ? t('editor.published') : t('editor.saved'),
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function update(patch: Partial<EditorState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }
  function setConfig(config: LaunchpadConfig) {
    update({ config })
  }

  if (!isNew && existing.isLoading) {
    return <LaunchpadEditorSkeleton />
  }
  if (!isNew && existing.isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('editor.notFound')}</p>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/launchpads')}
        >
          <ArrowLeft className="size-4" />
          {t('editor.back')}
        </Button>
      </div>
    )
  }

  const publicUrl = buildLaunchpadUrl(form.slug)

  return (
    <div className="space-y-4">
      {/* Top bar: identity + actions. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('editor.back')}
          onClick={() => router.push('/dashboard/launchpads')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <Input
            value={form.title}
            placeholder={t('editor.titlePlaceholder')}
            maxLength={256}
            className="h-9 max-w-sm border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>
        <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>
          {t(`status.${form.status}`)}
        </Badge>
        {form.status === 'published' && form.slug && (
          <Button variant="outline" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              {tc('open')}
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={save.isPending}
          onClick={() => save.mutate('draft')}
        >
          <Save className="size-4" />
          {t('editor.saveDraft')}
        </Button>
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() => save.mutate('published')}
        >
          <Send className="size-4" />
          {t('editor.publish')}
        </Button>
      </div>

      {/* Slug + unsaved indicator. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('editor.slugLabel')}</span>
        <span className="text-muted-foreground">/m/</span>
        <Input
          value={form.slug}
          placeholder={t('editor.slugPlaceholder')}
          maxLength={2048}
          className="h-8 w-48 font-mono"
          onChange={(e) => update({ slug: e.target.value })}
        />
        {dirty && (
          <span className="text-xs text-muted-foreground">
            {t('editor.unsaved')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Editor tabs. */}
        <div className="min-w-0 flex-1">
          <Tabs defaultValue="build">
            <TabsList>
              <TabsTrigger value="build">{t('editor.tabs.build')}</TabsTrigger>
              <TabsTrigger value="design">
                {t('editor.tabs.design')}
              </TabsTrigger>
              <TabsTrigger value="track">{t('editor.tabs.track')}</TabsTrigger>
            </TabsList>
            <TabsContent value="build" className="pt-4">
              <BuildTab
                config={form.config}
                links={links}
                onChange={setConfig}
              />
            </TabsContent>
            <TabsContent value="design" className="pt-4">
              <DesignTab config={form.config} onChange={setConfig} />
            </TabsContent>
            <TabsContent value="track" className="pt-4">
              <TrackTab launchpadId={currentId} config={form.config} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right-side mobile live preview. */}
        <div className="lg:w-[360px] lg:shrink-0">
          <div className="lg:sticky lg:top-20">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="size-3.5" />
              {t('editor.preview')}
            </p>
            <div className="mx-auto h-[640px] w-full max-w-[360px] overflow-y-auto rounded-[2rem] border-8 border-muted bg-background shadow-inner [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LaunchpadPreview
                mode="device"
                config={form.config}
                linkRefs={linkRefs}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
