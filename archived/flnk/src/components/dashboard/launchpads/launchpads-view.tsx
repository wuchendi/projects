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
import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Card } from '@cdlab/ui/components/card'
import { CopyButton } from '@cdlab/ui/components/copy-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { Input } from '@cdlab/ui/components/input'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { IKEmpty } from '@cdlab/ui/IK/IKEmpty'
import { cn } from '@cdlab/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarIcon,
  ExternalLink,
  Eye,
  Inbox,
  MousePointerClick,
  Pencil,
  Plus,
  Rocket,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LaunchpadPreview } from '@/components/dashboard/launchpads/launchpad-preview'
import {
  ListLayoutToggle,
  listViewClass,
} from '@/components/dashboard/list-view'
import type { LinkRef } from '@/components/launchpad/launchpad-view'
import {
  buildLaunchpadUrl,
  formatDate,
  formatNumber,
} from '@/lib/format/format'
import type { LaunchpadRow } from '@/lib/platform/api'
import { launchpadApi } from '@/lib/platform/api'
import { useLaunchpadsViewStore } from '@/stores/launchpads-view-store'
import { useLinkRefs } from './use-link-refs'

const STATS_WINDOW_MS = 365 * 24 * 60 * 60 * 1000

export function LaunchpadsView() {
  const t = useTranslations('launchpads')
  const router = useRouter()
  const queryClient = useQueryClient()

  const { view, setView } = useLaunchpadsViewStore()
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState<LaunchpadRow | null>(null)

  const query = useQuery({
    queryKey: ['launchpads'],
    queryFn: () =>
      launchpadApi.list({ limit: 100, offset: 0, sort: 'createdAt' }),
  })

  const linkRefs = useLinkRefs()

  const remove = useMutation({
    mutationFn: (id: string) => launchpadApi.remove(id),
    onSuccess: () => {
      toast.success(t('delete.success'))
      setToDelete(null)
      void queryClient.invalidateQueries({ queryKey: ['launchpads'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = query.data?.launchpads ?? []
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => `${r.title} ${r.slug}`.toLowerCase().includes(q))
  }, [rows, search])

  // One batched stats request for the whole page (keyed by the id set + window)
  // instead of one query per card — kills the AE N+1 fan-out on mount.
  const statsIds = useMemo(() => rows.map((r) => r.id), [rows])
  const statsQuery = useQuery({
    queryKey: ['launchpad-stats-batch', statsIds.join(','), STATS_WINDOW_MS],
    queryFn: () =>
      launchpadApi.statsBatch(statsIds, Date.now() - STATS_WINDOW_MS),
    enabled: statsIds.length > 0,
  })
  const statsMap = statsQuery.data?.stats

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => router.push('/dashboard/launchpads/new')}>
          <Plus />
          {t('new')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 md:min-w-[14rem] md:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              aria-label={t('clearSearch')}
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* View toggle stays visible at every breakpoint (mirrors Links). */}
        <ListLayoutToggle
          value={view}
          onChange={setView}
          listLabel={t('viewList')}
          gridLabel={t('viewGrid')}
        />
      </div>

      {query.isLoading ? (
        <div className={listViewClass(view)}>
          {['a', 'b', 'c'].map((k) => (
            <Skeleton
              key={k}
              className={cn(
                'w-full rounded-lg',
                view === 'grid' ? 'h-72' : 'h-24',
              )}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <IKEmpty className="h-40" title={t('empty')} icon={Inbox}>
          <Button onClick={() => router.push('/dashboard/launchpads/new')}>
            <Plus />
            {t('new')}
          </Button>
        </IKEmpty>
      ) : (
        <div className={listViewClass(view)}>
          {visible.map((row) => (
            <LaunchpadCard
              key={row.id}
              row={row}
              view={view}
              linkRefs={linkRefs}
              stats={statsMap?.[row.id]}
              onEdit={() => router.push(`/dashboard/launchpads/${row.id}`)}
              onDelete={() => setToDelete(row)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.desc', { slug: toDelete?.slug ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (toDelete) remove.mutate(toDelete.id)
              }}
            >
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LaunchpadCard({
  row,
  view,
  linkRefs,
  stats,
  onEdit,
  onDelete,
}: {
  row: LaunchpadRow
  view: 'list' | 'grid'
  linkRefs: Record<string, LinkRef>
  stats?: { views: number; engagements: number }
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useTranslations('launchpads')
  const tc = useTranslations('common')
  const locale = useLocale()
  const publicUrl = buildLaunchpadUrl(row.slug)

  // Shared row pieces so the list (horizontal) and grid (vertical) layouts stay
  // in sync without duplicating markup.
  const thumb = (
    <button
      type="button"
      onClick={onEdit}
      aria-label={tc('edit')}
      className={cn(
        'block overflow-hidden bg-muted/30 text-left',
        view === 'grid'
          ? 'h-44 w-full border-b'
          : 'h-20 w-32 shrink-0 rounded-lg border',
      )}
    >
      <LaunchpadPreview
        mode="thumb"
        config={row.config}
        linkRefs={linkRefs}
        className="h-full w-full"
      />
    </button>
  )

  const titleBlock = (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 truncate font-semibold leading-tight">
        {row.title || row.slug}
        <Badge
          variant={row.status === 'published' ? 'default' : 'secondary'}
          className="shrink-0 text-[10px]"
        >
          {t(`status.${row.status}`)}
        </Badge>
      </h3>
      <div className="mt-1 flex items-center gap-1.5">
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="truncate text-sm font-medium text-primary hover:underline"
        >
          /m/{row.slug}
        </a>
        <CopyButton
          value={publicUrl}
          size="icon-xs"
          aria-label={tc('copy')}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        />
      </div>
    </div>
  )

  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('actions')}>
          <Rocket className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-36" align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          {tc('edit')}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            {tc('open')}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          {tc('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const meta = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Eye className="size-3.5" />
        {formatNumber(stats?.views ?? 0, locale)}
      </span>
      <span className="flex items-center gap-1">
        <MousePointerClick className="size-3.5" />
        {formatNumber(stats?.engagements ?? 0, locale)}
      </span>
      <span className="flex items-center gap-1">
        <CalendarIcon className="size-3.5" />
        {formatDate(row.updatedAt, locale)}
      </span>
    </div>
  )

  if (view === 'list') {
    return (
      <Card className="flex flex-row items-center gap-3 border p-4 transition-all hover:border-primary/60 hover:shadow-xl">
        {thumb}
        <div className="min-w-0 flex-1 space-y-1.5">
          {titleBlock}
          {meta}
        </div>
        {actions}
      </Card>
    )
  }

  return (
    <Card className="gap-0 overflow-hidden border p-0 transition-all hover:border-primary/60 hover:shadow-xl">
      {/* Live scaled mini-preview — no screenshot pipeline. */}
      {thumb}
      <div className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          {titleBlock}
          {actions}
        </div>
        {meta}
      </div>
    </Card>
  )
}
