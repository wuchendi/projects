'use client'

import { Button } from '@cdlab/ui/components/button'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import { cn } from '@cdlab/ui/lib/utils'
import { X } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

const DEFAULT_VISIBLE = 10

interface FilterItem {
  id: string
  name: string
  count: number
}

interface FilterBadgesProps {
  icon: React.ReactNode
  label: string
  items: FilterItem[]
  selected: Set<string>
  onToggle: (id: string) => void
  className?: string
}

export const FilterBadges = memo(function FilterBadges({
  icon,
  label,
  items,
  selected,
  onToggle,
  className,
}: FilterBadgesProps) {
  const [expanded, setExpanded] = useState(false)
  const selectedValues = Array.from(selected)
  const hasMore = items.length > DEFAULT_VISIBLE
  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE)

  const handleValueChange = useCallback(
    (values: string[]) => {
      const newSet = new Set(values)
      const changed = [...newSet]
        .filter((id) => !selected.has(id))
        .concat([...selected].filter((id) => !newSet.has(id)))
      changed.forEach((id) => onToggle(id))
    },
    [selected, onToggle],
  )

  if (items.length === 0) return null

  return (
    <div className={cn('flex items-start gap-2 min-w-0', className)}>
      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 h-6">
        {icon}
        {label}
      </span>

      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
        <ToggleGroup
          multiple
          variant="outline"
          spacing={1.5}
          size="sm"
          value={selectedValues}
          onValueChange={handleValueChange}
          className="flex items-center flex-wrap gap-1.5"
        >
          {visibleItems.map((item) => (
            <ToggleGroupItem
              key={item.id}
              value={item.id}
              aria-label={`${item.name}，${item.count} 个${selected.has(item.id) ? '，已选中' : ''}`}
              className="text-xs h-6 px-2 gap-1"
            >
              {item.name}
              <span className="text-muted-foreground tabular-nums">
                {item.count}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起' : `+${items.length - DEFAULT_VISIBLE} 更多`}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {selected.size > 0 && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => selected.forEach((id) => onToggle(id))}
            aria-label="清除筛选"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>
    </div>
  )
})
