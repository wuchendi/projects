'use client'

import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import { LayoutGrid, List } from 'lucide-react'

export type ListView = 'list' | 'grid'

// Container className shared by the links and launchpads dashboards for both the
// loading skeleton and the card list, so grid/list layouts stay in sync.
export function listViewClass(view: ListView): string {
  return view === 'grid'
    ? 'grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3'
    : 'space-y-2.5'
}

interface ListLayoutToggleProps {
  value: ListView
  onChange: (view: ListView) => void
  // Labels stay per-site props: the two views read them from different i18n
  // namespaces (and the zh copy differs), so the toggle keeps rendering identical.
  listLabel: string
  gridLabel: string
  className?: string
}

// The list/grid layout switch shared by the links and launchpads dashboards.
export function ListLayoutToggle({
  value,
  onChange,
  listLabel,
  gridLabel,
  className = 'shrink-0',
}: ListLayoutToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as ListView)}
      variant="outline"
      className={className}
    >
      <ToggleGroupItem value="list" aria-label={listLabel}>
        <List className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label={gridLabel}>
        <LayoutGrid className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
