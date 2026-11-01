'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@cdlab/ui/components/alert-dialog'
import { Button } from '@cdlab/ui/components/button'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { IKEmpty } from '@cdlab/ui/IK/IKEmpty'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enUS, zhCN } from 'date-fns/locale'
import { Inbox, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DeleteDialog } from '@/components/dashboard/links/delete-dialog'
import { LinkCard } from '@/components/dashboard/links/link-card'
import { LinkDrawer } from '@/components/dashboard/links/link-drawer'
import { LinksBulkBar } from '@/components/dashboard/links/links-bulk-bar'
import { LinksFilterBar } from '@/components/dashboard/links/links-filter-bar'
import { listViewClass } from '@/components/dashboard/list-view'
import type { LinkRow } from '@/lib/platform/api'
import { linkApi, statsApi } from '@/lib/platform/api'
import { queryKeys } from '@/lib/platform/query-keys'
import { useLinksFilterStore } from '@/stores/links-filter-store'

const PAGE_SIZE = 20

// Effective status of a link, used to filter the search-result path client-side
// (the list path filters on the server).
function linkStatus(link: LinkRow): 'active' | 'disabled' | 'expired' {
  if (link.config.disabled) return 'disabled'
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now())
    return 'expired'
  return 'active'
}

export function LinksView() {
  const t = useTranslations('links')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dateLocale = locale === 'zh' ? zhCN : enUS
  const router = useRouter()
  const queryClient = useQueryClient()

  const {
    search,
    sort,
    status,
    startAt,
    endAt,
    tags,
    tagMatch,
    untagged,
    view,
    setSearch,
    toggleTag,
  } = useLinksFilterStore()

  const [input, setInput] = useState(search)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkTagDraft, setBulkTagDraft] = useState('')
  const [toDelete, setToDelete] = useState<LinkRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // undefined → create; a row → edit. Kept while the drawer animates closed.
  const [editing, setEditing] = useState<LinkRow | undefined>(undefined)

  function openCreate() {
    setEditing(undefined)
    setDrawerOpen(true)
  }
  function openEdit(link: LinkRow) {
    setEditing(link)
    setDrawerOpen(true)
  }

  // Debounce the search box into the store.
  useEffect(() => {
    const id = setTimeout(() => setSearch(input.trim()), 300)
    return () => clearTimeout(id)
  }, [input, setSearch])

  // Any filter change resets pagination — the deps are intentional triggers
  // even though the body only calls the stable setPage.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional triggers
  useEffect(() => {
    setPage(0)
  }, [search, sort, status, startAt, endAt, tags, tagMatch, untagged])

  const isSearching = search.length > 0

  const query = useQuery({
    queryKey: [
      'links',
      {
        search,
        sort,
        page,
        status,
        startAt,
        endAt,
        tags,
        tagMatch,
        untagged,
      },
    ],
    queryFn: () =>
      isSearching
        ? linkApi
            .search(search)
            .then((r) => ({ links: r.links, total: r.links.length }))
        : linkApi.list({
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
            sort,
            status,
            startAt,
            endAt,
            tags,
            tagMatch,
            untagged,
          }),
  })

  const tagsQuery = useQuery({
    queryKey: ['link-tags'],
    queryFn: () => linkApi.tags(),
  })

  // Click counts for every slug in the last 30 days, fetched in one batched
  // metrics call (grouped by slug) rather than one request per visible link.
  const clicksWindow = useMemo(() => {
    const end = Date.now()
    return { startAt: end - 30 * 24 * 60 * 60 * 1000, endAt: end }
  }, [])
  const clicksQuery = useQuery({
    queryKey: queryKeys.metrics('slug', { ...clicksWindow, filters: {} }, 50),
    queryFn: () =>
      statsApi.metrics('slug', { ...clicksWindow, filters: {} }, 50),
  })
  const clicks = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of clicksQuery.data?.metrics ?? []) map.set(m.name, m.count)
    return map
  }, [clicksQuery.data])

  const remove = useMutation({
    mutationFn: (id: string) => linkApi.remove(id),
    onSuccess: () => {
      toast.success(t('delete.success'))
      setToDelete(null)
      void queryClient.invalidateQueries({ queryKey: ['links'] })
      // Deleting a link changes the total count and the overview/analytics
      // stats — invalidate those key groups by prefix so every window drops.
      void queryClient.invalidateQueries({ queryKey: queryKeys.linkCount() })
      void queryClient.invalidateQueries({ queryKey: ['stats', 'counters'] })
      void queryClient.invalidateQueries({ queryKey: ['stats', 'metrics'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleDisabled = useMutation({
    mutationFn: (link: LinkRow) =>
      linkApi.edit({
        id: link.id,
        config: { ...link.config, disabled: !link.config.disabled },
      }),
    onSuccess: () => {
      toast.success(t('form.updated'))
      void queryClient.invalidateQueries({ queryKey: ['links'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = query.data?.links ?? []
  const total = query.data?.total ?? 0
  const pageCount = isSearching ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE))

  // The list path filters status/date/tags on the server. The search
  // path returns a single unfiltered page, so apply those filters client-side.
  const visibleRows = isSearching
    ? rows.filter((l) => {
        const rowTags = l.tags ?? []
        if (untagged) {
          if (rowTags.length > 0) return false
        } else if (tags.length > 0) {
          const ok =
            tagMatch === 'or'
              ? tags.some((tg) => rowTags.includes(tg))
              : tags.every((tg) => rowTags.includes(tg))
          if (!ok) return false
        }
        if (status !== 'all' && linkStatus(l) !== status) return false
        const created = new Date(l.createdAt).getTime()
        if (startAt && created < startAt) return false
        if (endAt && created > endAt) return false
        return true
      })
    : rows

  const allTags = tagsQuery.data?.tags ?? []
  const tagOptions = allTags.map((x) => x.tag)

  // Clear the selection whenever the underlying rows change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on data swap
  useEffect(() => {
    setSelected(new Set())
  }, [query.data])

  const selectedRows = visibleRows.filter((l) => selected.has(l.id))
  const allSelected =
    visibleRows.length > 0 && selectedRows.length === visibleRows.length

  function toggleOne(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  function toggleAll(on: boolean) {
    setSelected(on ? new Set(visibleRows.map((l) => l.id)) : new Set())
  }

  const bulkToggle = useMutation({
    mutationFn: async (disabled: boolean) => {
      await Promise.all(
        selectedRows.map((l) =>
          linkApi.edit({ id: l.id, config: { ...l.config, disabled } }),
        ),
      )
    },
    onSuccess: () => {
      toast.success(t('bulkUpdated', { count: selectedRows.length }))
      setSelected(new Set())
      void queryClient.invalidateQueries({ queryKey: ['links'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkRemove = useMutation({
    mutationFn: async () => {
      await Promise.all([...selected].map((id) => linkApi.remove(id)))
    },
    onSuccess: () => {
      toast.success(t('bulkDeleted', { count: selected.size }))
      setSelected(new Set())
      setBulkConfirm(false)
      void queryClient.invalidateQueries({ queryKey: ['links'] })
      void queryClient.invalidateQueries({ queryKey: ['link-tags'] })
      // Deleting links changes the total count and the overview/analytics
      // stats — invalidate those key groups by prefix so every window drops.
      void queryClient.invalidateQueries({ queryKey: queryKeys.linkCount() })
      void queryClient.invalidateQueries({ queryKey: ['stats', 'counters'] })
      void queryClient.invalidateQueries({ queryKey: ['stats', 'metrics'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkTag = useMutation({
    mutationFn: (op: 'add' | 'remove') =>
      linkApi.tagBulk([...selected], bulkTagDraft.trim(), op),
    onSuccess: (r) => {
      toast.success(t('bulkTagged', { count: r.updated }))
      setBulkTagDraft('')
      setSelected(new Set())
      void queryClient.invalidateQueries({ queryKey: ['links'] })
      void queryClient.invalidateQueries({ queryKey: ['link-tags'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Per-row tag editing from the inline list editor — the staged tag set is
  // saved in one call when the popover closes.
  const inlineTag = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      linkApi.tagSet(id, tags),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['links'] })
      void queryClient.invalidateQueries({ queryKey: ['link-tags'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-row items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          {t('new')}
        </Button>
      </div>

      <LinksFilterBar
        input={input}
        onInputChange={setInput}
        allTags={allTags}
        dateLocale={dateLocale}
      />

      {selected.size > 0 && (
        <LinksBulkBar
          selectedCount={selected.size}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onEnable={() => bulkToggle.mutate(false)}
          onDisable={() => bulkToggle.mutate(true)}
          bulkTogglePending={bulkToggle.isPending}
          bulkTagDraft={bulkTagDraft}
          onBulkTagDraftChange={setBulkTagDraft}
          onBulkTagAdd={() => bulkTag.mutate('add')}
          onBulkTagRemove={() => bulkTag.mutate('remove')}
          bulkTagPending={bulkTag.isPending}
          onDeleteClick={() => setBulkConfirm(true)}
          onClear={() => setSelected(new Set())}
        />
      )}

      {query.isLoading ? (
        <div className={listViewClass(view)}>
          {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
            <Skeleton key={k} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : visibleRows.length === 0 ? (
        <IKEmpty className="h-40" title={t('empty')} icon={Inbox}>
          <Button onClick={openCreate}>
            <Plus />
            {t('new')}
          </Button>
        </IKEmpty>
      ) : (
        <div className={listViewClass(view)}>
          {visibleRows.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              view={view}
              selected={selected.has(link.id)}
              count={clicks.get(link.slug) ?? 0}
              selectedTags={tags}
              tagOptions={tagOptions}
              inlineTagPending={inlineTag.isPending}
              toggleDisabledPending={toggleDisabled.isPending}
              onToggleSelect={toggleOne}
              onToggleTag={toggleTag}
              onInlineTagSave={(id, nextTags) =>
                inlineTag.mutate({ id, tags: nextTags })
              }
              onEdit={openEdit}
              onDelete={setToDelete}
              onToggleDisabled={(l) => toggleDisabled.mutate(l)}
              onViewAnalytics={(slug) =>
                router.push(
                  `/dashboard/analytics?slug=${encodeURIComponent(slug)}`,
                )
              }
            />
          ))}
        </div>
      )}

      {!isSearching && pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('pageOf', { page: page + 1, total: pageCount })}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {tc('prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              {tc('next')}
            </Button>
          </div>
        </div>
      )}

      <LinkDrawer
        open={drawerOpen}
        existing={editing}
        onOpenChange={setDrawerOpen}
      />

      <DeleteDialog
        slug={toDelete?.slug ?? ''}
        open={!!toDelete}
        pending={remove.isPending}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('bulkDeleteTitle', { count: selected.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulkDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkRemove.isPending}
              onClick={(e) => {
                e.preventDefault()
                bulkRemove.mutate()
              }}
            >
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
