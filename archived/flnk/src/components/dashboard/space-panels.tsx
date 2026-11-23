'use client'

import { IconButton } from '@cdlab/ui/shell/layout/icon-button'
import {
  PanelAllRow,
  PanelFrame,
  PanelRow,
  PanelSection,
} from '@cdlab/ui/shell/layout/panel'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  CircleCheck,
  CircleSlash,
  Clock,
  List,
  Plus,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ComponentType } from 'react'
import { useMemo } from 'react'
import type { LinkStatusFilter } from '@/lib/platform/api'
import { launchpadApi, linkApi, statsApi } from '@/lib/platform/api'
import { queryKeys } from '@/lib/platform/query-keys'
import { useLinksFilterStore } from '@/stores/links-filter-store'

// The shell's space panels (the column beside a space's pages), modelled on
// tinylink's. They share react-query keys with the pages they sit beside.

const DAY_MS = 24 * 60 * 60 * 1000

// Most visited slugs over the last 30 days.
function useTopLinks() {
  const params = useMemo(() => {
    const endAt = Date.now()
    return { startAt: endAt - 30 * DAY_MS, endAt, filters: {} }
  }, [])
  return useQuery({
    queryKey: queryKeys.metrics('slug', params, 5),
    queryFn: () => statsApi.metrics('slug', params, 5),
  })
}

function TopLinksSection() {
  const t = useTranslations('dashboard.panel')
  const top = useTopLinks().data?.metrics ?? []
  if (top.length === 0) return null
  return (
    <PanelSection label={t('top30d')}>
      {top.map((m) => (
        <PanelRow
          key={m.name}
          href={`/dashboard/analytics?slug=${encodeURIComponent(m.name)}`}
          icon={TrendingUp}
          count={m.count}
        >
          /{m.name}
        </PanelRow>
      ))}
    </PanelSection>
  )
}

const LINK_VIEWS: { status: LinkStatusFilter; icon: typeof List }[] = [
  { status: 'active', icon: CircleCheck },
  { status: 'disabled', icon: CircleSlash },
  { status: 'expired', icon: Clock },
]

function LinksPanel() {
  const t = useTranslations('dashboard')
  const tl = useTranslations('links')
  const filter = useLinksFilterStore()
  const total = useQuery({
    queryKey: queryKeys.linkCount(),
    queryFn: () => linkApi.count(),
  }).data?.total
  const tags =
    useQuery({ queryKey: ['link-tags'], queryFn: () => linkApi.tags() }).data
      ?.tags ?? []
  const unfiltered =
    filter.status === 'all' && filter.tags.length === 0 && !filter.untagged

  // Rows change the links filter, then open the links page.
  return (
    <PanelFrame title={t('nav.links')}>
      <PanelSection label={t('panel.views')}>
        <PanelRow
          href="/dashboard/links"
          icon={List}
          count={total}
          active={unfiltered}
          onClick={filter.resetFilters}
        >
          {t('panel.allLinks')}
        </PanelRow>
        {LINK_VIEWS.map(({ status, icon }) => (
          <PanelRow
            key={status}
            href="/dashboard/links"
            icon={icon}
            active={filter.status === status}
            onClick={() =>
              filter.setStatus(filter.status === status ? 'all' : status)
            }
          >
            {tl(`status.${status}`)}
          </PanelRow>
        ))}
      </PanelSection>
      <PanelSection label={t('panel.tags')}>
        {tags.map(({ tag, count }) => (
          <PanelRow
            key={tag}
            href="/dashboard/links"
            icon={Tag}
            count={count}
            active={filter.tags.includes(tag)}
            onClick={() => filter.toggleTag(tag)}
          >
            {tag}
          </PanelRow>
        ))}
        <PanelRow
          href="/dashboard/links"
          icon={Tag}
          active={filter.untagged}
          onClick={() => filter.setUntagged(!filter.untagged)}
        >
          {tl('untagged')}
        </PanelRow>
      </PanelSection>
      <TopLinksSection />
    </PanelFrame>
  )
}

function LaunchpadsPanel() {
  const t = useTranslations('dashboard')
  const tlp = useTranslations('launchpads')
  const router = useRouter()
  const pathname = usePathname()
  // Same key and params as the launchpads page, so both share one fetch.
  const launchpads =
    useQuery({
      queryKey: ['launchpads'],
      queryFn: () =>
        launchpadApi.list({ limit: 100, offset: 0, sort: 'createdAt' }),
    }).data?.launchpads ?? []

  return (
    <PanelFrame
      title={t('nav.launchpads')}
      actions={
        <IconButton
          label={tlp('new')}
          icon={Plus}
          onClick={() => router.push('/dashboard/launchpads/new')}
        />
      }
    >
      {launchpads.length > 0 && (
        <>
          <PanelSection label={t('nav.launchpads')}>
            {launchpads.map((lp) => (
              <PanelRow
                key={lp.id}
                href={`/dashboard/launchpads/${lp.id}`}
                dot={lp.status === 'published' ? 'success' : 'muted'}
                title={`${lp.title || lp.slug} · ${tlp(`status.${lp.status}`)}`}
                active={pathname === `/dashboard/launchpads/${lp.id}`}
              >
                {lp.title || lp.slug}
              </PanelRow>
            ))}
          </PanelSection>
          <PanelAllRow
            href="/dashboard/launchpads"
            label={t('panel.allLaunchpads', { count: launchpads.length })}
            active={pathname === '/dashboard/launchpads'}
          />
        </>
      )}
    </PanelFrame>
  )
}

// Shared by the 分析 and 实时 spaces: switch between the two views, plus the
// most visited links.
function AnalyticsPanel() {
  const t = useTranslations('dashboard')
  const pathname = usePathname()
  return (
    <PanelFrame title={t('nav.analytics')}>
      <PanelSection label={t('panel.views')}>
        <PanelRow
          href="/dashboard/analytics"
          icon={Sparkles}
          active={pathname === '/dashboard/analytics'}
        >
          {t('nav.analytics')}
        </PanelRow>
        <PanelRow
          href="/dashboard/realtime"
          icon={Activity}
          active={pathname === '/dashboard/realtime'}
        >
          {t('nav.realtime')}
        </PanelRow>
      </PanelSection>
      <TopLinksSection />
    </PanelFrame>
  )
}

/** Panels by space key; overview, check, migrate and settings have none. */
export const SPACE_PANELS: Partial<Record<string, ComponentType>> = {
  links: LinksPanel,
  launchpads: LaunchpadsPanel,
  analytics: AnalyticsPanel,
  realtime: AnalyticsPanel,
}
