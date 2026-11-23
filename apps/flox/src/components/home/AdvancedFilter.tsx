'use client'

import { Button } from '@cdlab/ui/components/button'
import { Card, CardContent } from '@cdlab/ui/components/card'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import {
  ArrowUpDownIcon,
  FilmIcon,
  GlobeIcon,
  SparklesIcon,
  StarIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { FilterPreset, FilterState } from '@/lib/hooks/useAdvancedFilter'
import {
  COUNTRY_OPTIONS,
  GENRE_OPTIONS,
  SORT_OPTIONS,
} from '@/lib/hooks/useAdvancedFilter'

interface AdvancedFilterProps {
  filter: FilterState
  presets: FilterPreset[]
  presetsLoading?: boolean
  onFilterChange: (partial: Partial<FilterState>) => void
}

const DEFAULT_VISIBLE = 10
// Base UI Toggle ignores an empty-string value, so "all" uses a sentinel
const ALL_VALUE = '__all__'

function FilterRow({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = options.length > DEFAULT_VISIBLE
  const visibleOptions = expanded ? options : options.slice(0, DEFAULT_VISIBLE)

  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 h-6">
        {icon}
        {label}
      </span>

      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
        <ToggleGroup
          variant="outline"
          spacing={1.5}
          size="sm"
          value={[value || ALL_VALUE]}
          onValueChange={(v) => {
            const next = v[0] ?? ''
            onChange(next === ALL_VALUE ? '' : next)
          }}
          className="flex items-center flex-wrap gap-1.5"
        >
          <ToggleGroupItem
            value={ALL_VALUE}
            aria-label="全部"
            className="text-xs h-6 px-2"
          >
            全部
          </ToggleGroupItem>
          {visibleOptions.map((opt) => (
            <ToggleGroupItem
              key={opt}
              value={opt}
              aria-label={opt}
              className="text-xs h-6 px-2"
            >
              {opt}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起' : `+${options.length - DEFAULT_VISIBLE} 更多`}
          </Button>
        )}
      </div>
    </div>
  )
}

function ScoreFilter({
  value,
  onChange,
}: {
  value: [number, number]
  onChange: (value: [number, number]) => void
}) {
  const ranges: { label: string; range: [number, number] }[] = [
    { label: '全部', range: [0, 10] },
    { label: '9分以上', range: [9, 10] },
    { label: '8-9分', range: [8, 9] },
    { label: '7-8分', range: [7, 8] },
    { label: '6-7分', range: [6, 7] },
    { label: '6分以下', range: [0, 6] },
  ]

  // Find the matching range key
  const currentKey =
    ranges.find((r) => r.range[0] === value[0] && r.range[1] === value[1])
      ?.label ?? '全部'

  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 h-6">
        <StarIcon className="size-3.5 text-muted-foreground shrink-0" />
        评分
      </span>

      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
        <ToggleGroup
          variant="outline"
          spacing={1.5}
          size="sm"
          value={[currentKey]}
          onValueChange={(keys) => {
            const matched = ranges.find((r) => r.label === keys[0])
            if (matched) onChange(matched.range)
          }}
          className="flex items-center flex-wrap gap-1.5"
        >
          {ranges.map((r) => (
            <ToggleGroupItem
              key={r.label}
              value={r.label}
              aria-label={r.label}
              className="text-xs h-6 px-2"
            >
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}

export function AdvancedFilter({
  filter,
  presets,
  presetsLoading = false,
  onFilterChange,
}: AdvancedFilterProps) {
  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-2 pt-4">
        {/* Presets */}
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 h-6">
            <SparklesIcon className="size-3.5 text-muted-foreground shrink-0" />
            快捷
          </span>

          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
            {presetsLoading && (
              <span className="text-xs text-muted-foreground">加载中...</span>
            )}
            {presets.map((preset) => {
              const isActive =
                filter.sort === (preset.filter.sort ?? filter.sort) &&
                filter.genres === (preset.filter.genres ?? filter.genres) &&
                filter.countries ===
                  (preset.filter.countries ?? filter.countries) &&
                filter.scoreRange[0] ===
                  (preset.filter.scoreRange?.[0] ?? filter.scoreRange[0]) &&
                filter.scoreRange[1] ===
                  (preset.filter.scoreRange?.[1] ?? filter.scoreRange[1])

              return (
                <Button
                  key={preset.label}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => onFilterChange(preset.filter)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 h-6">
            <ArrowUpDownIcon className="size-3.5 text-muted-foreground shrink-0" />
            排序
          </span>

          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
            <ToggleGroup
              variant="outline"
              spacing={1.5}
              size="sm"
              value={[filter.sort]}
              onValueChange={(v) => {
                if (v[0]) onFilterChange({ sort: v[0] as FilterState['sort'] })
              }}
              className="flex items-center flex-wrap gap-1.5"
            >
              {SORT_OPTIONS.map((opt) => (
                <ToggleGroupItem
                  key={opt.value}
                  value={opt.value}
                  aria-label={opt.label}
                  className="text-xs h-6 px-2"
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        {/* Genre */}
        <FilterRow
          label="类型"
          icon={
            <FilmIcon className="size-3.5 text-muted-foreground shrink-0" />
          }
          options={GENRE_OPTIONS}
          value={filter.genres}
          onChange={(genres) => onFilterChange({ genres })}
        />

        {/* Country */}
        <FilterRow
          label="地区"
          icon={
            <GlobeIcon className="size-3.5 text-muted-foreground shrink-0" />
          }
          options={COUNTRY_OPTIONS}
          value={filter.countries}
          onChange={(countries) => onFilterChange({ countries })}
        />

        {/* Score */}
        <ScoreFilter
          value={filter.scoreRange}
          onChange={(scoreRange) => onFilterChange({ scoreRange })}
        />
      </CardContent>
    </Card>
  )
}
