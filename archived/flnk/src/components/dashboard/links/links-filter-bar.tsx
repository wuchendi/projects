'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { DateRangePicker } from '@cdlab/ui/components/date-range-picker'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@cdlab/ui/components/sheet'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import { endOfDay, startOfDay } from 'date-fns'
import type { Locale } from 'date-fns/locale'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { KeyboardEvent } from 'react'
import { ListLayoutToggle } from '@/components/dashboard/list-view'
import type { SortKey } from '@/lib/platform/api'
import {
  hasActiveFilters,
  useLinksFilterStore,
} from '@/stores/links-filter-store'

const SORTS: SortKey[] = ['createdAt', 'updatedAt', 'expiresAt']
const STATUSES = ['active', 'disabled', 'expired'] as const

// Fire a click-equivalent handler when a non-button element is activated via
// the keyboard (Enter / Space) so clickable badges stay operable.
function onActivateKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }
}

interface LinksFilterBarProps {
  input: string
  onInputChange: (value: string) => void
  allTags: { tag: string; count: number }[]
  dateLocale: Locale
}

export function LinksFilterBar({
  input,
  onInputChange,
  allTags,
  dateLocale,
}: LinksFilterBarProps) {
  const t = useTranslations('links')
  const filter = useLinksFilterStore()
  const {
    sort,
    status,
    startAt,
    endAt,
    tags,
    tagMatch,
    untagged,
    view,
    setSort,
    setStatus,
    setDateRange,
    toggleTag,
    setTagMatch,
    setUntagged,
    setView,
    resetFilters,
  } = filter

  // Filter controls — rendered both inline (desktop) and inside the mobile
  // filter drawer. `mobile` stretches them full-width; the inline copies hide
  // below `md` so the drawer owns the small-screen layout.
  function statusSelect(mobile: boolean) {
    return (
      <Select
        value={status}
        onValueChange={(v) => setStatus(v as typeof status)}
      >
        <SelectTrigger
          className={mobile ? 'w-full' : 'hidden w-auto min-w-28 md:flex'}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  function dateRangePicker(mobile: boolean) {
    return (
      <DateRangePicker
        value={{
          from: startAt ? new Date(startAt) : undefined,
          to: endAt ? new Date(endAt) : undefined,
        }}
        onChange={(range) =>
          setDateRange(
            range?.from ? startOfDay(range.from).getTime() : null,
            range?.to ? endOfDay(range.to).getTime() : null,
          )
        }
        presets={[]}
        numberOfMonths={2}
        locale={dateLocale}
        placeholder={t('dateRange')}
        className={mobile ? 'w-full' : 'hidden md:flex'}
      />
    )
  }

  function sortSelect(mobile: boolean) {
    return (
      <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
        <SelectTrigger
          className={mobile ? 'w-full' : 'hidden w-auto min-w-32 md:flex'}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`sort.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Active filters surfaced in the mobile drawer (drives the trigger badge).
  const drawerActiveCount =
    (status !== 'all' ? 1 : 0) +
    (startAt || endAt ? 1 : 0) +
    (tags.length > 0 || untagged ? 1 : 0)

  function clearAll() {
    onInputChange('')
    resetFilters()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Search stays on the far left at every breakpoint. */}
        <div className="relative min-w-0 flex-1 md:min-w-[14rem]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9 pr-9"
          />
          {input && (
            <button
              type="button"
              aria-label={t('clearSearch')}
              onClick={() => onInputChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Mobile: collapse the filter controls into a right-side drawer. */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('filters')}
              className="relative shrink-0 md:hidden"
            >
              <SlidersHorizontal className="size-4" />
              {drawerActiveCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {drawerActiveCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t('filters')}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-2">
                <Label>{t('statusLabel')}</Label>
                {statusSelect(true)}
              </div>
              <div className="space-y-2">
                <Label>{t('dateRange')}</Label>
                {dateRangePicker(true)}
              </div>
              <div className="space-y-2">
                <Label>{t('sortLabel')}</Label>
                {sortSelect(true)}
              </div>
              {hasActiveFilters(filter) && (
                <Button variant="outline" className="w-full" onClick={clearAll}>
                  <X className="size-4" />
                  {t('clearFilters')}
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop: filter controls inline (hidden on mobile). */}
        {sortSelect(false)}
        {statusSelect(false)}
        {dateRangePicker(false)}

        {hasActiveFilters(filter) && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:flex"
            onClick={clearAll}
          >
            <X className="size-4" />
            {t('clearFilters')}
          </Button>
        )}

        {/* View toggle stays visible at every breakpoint. */}
        <ListLayoutToggle
          value={view}
          onChange={setView}
          listLabel={t('viewList')}
          gridLabel={t('viewGrid')}
        />
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-sm text-muted-foreground">
            {t('filterByTag')}
          </span>
          {allTags.map(({ tag, count }) => (
            <Badge
              key={tag}
              variant={tags.includes(tag) ? 'default' : 'secondary'}
              role="button"
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => toggleTag(tag)}
              onKeyDown={onActivateKey(() => toggleTag(tag))}
            >
              {tag}
              <span className="ml-1 opacity-60">{count}</span>
            </Badge>
          ))}
          {/* Untagged is mutually exclusive with tag selection (see store). */}
          <Badge
            variant={untagged ? 'default' : 'outline'}
            role="button"
            tabIndex={0}
            className="cursor-pointer"
            onClick={() => setUntagged(!untagged)}
            onKeyDown={onActivateKey(() => setUntagged(!untagged))}
          >
            {t('untagged')}
          </Badge>
          {tags.length > 1 && (
            <ToggleGroup
              type="single"
              value={tagMatch}
              onValueChange={(v) => v && setTagMatch(v as 'and' | 'or')}
              variant="outline"
              size="sm"
              className="ml-1"
            >
              <ToggleGroupItem value="and">{t('tagMatchAnd')}</ToggleGroupItem>
              <ToggleGroupItem value="or">{t('tagMatchOr')}</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      )}
    </>
  )
}
