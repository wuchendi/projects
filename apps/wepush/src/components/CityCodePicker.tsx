'use client'

import { Button } from '@cdlab/ui/components/button'
import { Input } from '@cdlab/ui/components/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { Spinner } from '@cdlab/ui/components/spinner'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface CityEntry {
  code: string
  district: string
  city: string
  province: string
}

interface CityCodeData {
  source: string
  updatedAt: string
  count: number
  rows: CityEntry[]
}

interface Props {
  value: string
  onChange: (code: string) => void
  placeholder?: string
}

function formatLabel(c: CityEntry): string {
  return [c.province, c.city, c.district].filter(Boolean).join(' · ')
}

async function fetchAllCities(): Promise<CityEntry[]> {
  const res = await fetch('/data/city-codes.json')
  if (!res.ok) throw new Error('Failed to load city-codes.json')
  const data = (await res.json()) as CityCodeData
  return data.rows
}

function matches(c: CityEntry, q: string): boolean {
  return (
    c.code.startsWith(q) ||
    c.district.includes(q) ||
    c.city.includes(q) ||
    c.province.includes(q)
  )
}

const MAX_RESULTS = 80

export function CityCodePicker({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 120)
    return () => clearTimeout(t)
  }, [query])

  const { data: rows, isLoading } = useQuery({
    queryKey: ['city-codes'],
    queryFn: fetchAllCities,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const selected = useMemo(
    () => rows?.find((c) => c.code === value),
    [rows, value],
  )

  const results = useMemo(() => {
    if (!rows) return []
    const q = debouncedQuery.trim()
    if (!q) return rows.slice(0, MAX_RESULTS)
    const out: CityEntry[] = []
    for (const c of rows) {
      if (matches(c, q)) {
        out.push(c)
        if (out.length >= MAX_RESULTS) break
      }
    }
    return out
  }, [rows, debouncedQuery])

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'itboy 城市编码'}
        className="flex-1 font-mono"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-52 shrink-0 justify-between"
              title={selected ? formatLabel(selected) : '点击搜索城市'}
            />
          }
        >
          <span className="truncate text-sm">
            {selected ? formatLabel(selected) : '搜索城市...'}
          </span>
          <ChevronsUpDown className="ml-1 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入省 / 市 / 县区 / 编码"
              className="h-8 text-sm"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {isLoading ? (
              <li className="flex justify-center py-6">
                <Spinner className="size-4" />
              </li>
            ) : results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                未找到匹配
              </li>
            ) : (
              results.map((c) => {
                const active = c.code === value
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
                      onClick={() => {
                        onChange(c.code)
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      <Check
                        className={`size-4 shrink-0 ${
                          active ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <span className="flex-1 truncate">{formatLabel(c)}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.code}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
