'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import { Progress } from '@cdlab/ui/components/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cdlab/ui/components/table'
import { Tabs, TabsList, TabsTrigger } from '@cdlab/ui/components/tabs'
import { downloadFile } from '@cdlab/utils'
import { Download, Play, RefreshCw, Square, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { generateCsv } from '@/lib/format/csv'
import { formatNumber } from '@/lib/format/format'
import type { CheckResult, LinkRow } from '@/lib/platform/api'
import { checkApi, linkApi } from '@/lib/platform/api'

type Verdict = 'ok' | 'broken' | 'unsafe'

function verdictOf(r: CheckResult): Verdict {
  if (r.unsafe === true) return 'unsafe'
  if (!r.ok) return 'broken'
  return 'ok'
}

const TABS = ['all', 'ok', 'broken', 'unsafe'] as const
type Tab = (typeof TABS)[number]

const BADGE: Record<Verdict, 'secondary' | 'destructive'> = {
  ok: 'secondary',
  broken: 'destructive',
  unsafe: 'destructive',
}

const STAT_KEYS = ['total', 'checked', 'ok', 'broken', 'unsafe'] as const

// Pull the full target list in one shot (server caps at LIST_QUERY_LIMIT).
const LOAD_LIMIT = 500
const MAX_BATCH = 10

function clamp(value: number, lo: number, hi: number): number {
  if (Number.isNaN(value)) return lo
  return Math.min(hi, Math.max(lo, value))
}

export function CheckView() {
  const t = useTranslations('check')
  const locale = useLocale()

  const [timeout, setTimeoutValue] = useState(6)
  const [batchSize, setBatchSize] = useState(6)
  const [targets, setTargets] = useState<LinkRow[]>([])
  const [results, setResults] = useState<CheckResult[]>([])
  const [checking, setChecking] = useState(false)
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const stopRef = useRef(false)

  async function loadLinks(): Promise<LinkRow[]> {
    setLoadingLinks(true)
    try {
      const { links } = await linkApi.list({
        limit: LOAD_LIMIT,
        offset: 0,
        sort: 'createdAt',
      })
      setTargets(links)
      return links
    } catch (e) {
      toast.error((e as Error).message)
      return targets
    } finally {
      setLoadingLinks(false)
    }
  }

  async function start() {
    if (checking) return
    let list = targets
    if (list.length === 0) list = await loadLinks()
    if (list.length === 0) {
      toast.error(t('noLinks'))
      return
    }

    setChecking(true)
    stopRef.current = false
    setResults([])
    const size = clamp(batchSize, 1, MAX_BATCH)
    try {
      for (let i = 0; i < list.length; i += size) {
        if (stopRef.current) break
        const batch = list.slice(i, i + size)
        try {
          const { results: batchResults } = await checkApi.run(
            batch.map((l) => l.id),
            timeout,
          )
          setResults((prev) => [...prev, ...batchResults])
        } catch (e) {
          // A failed batch request shouldn't abort the run — record the whole
          // batch as failed and keep going.
          const message = (e as Error).message
          setResults((prev) => [
            ...prev,
            ...batch.map<CheckResult>((l) => ({
              id: l.id,
              slug: l.slug,
              url: l.url,
              status: null,
              ok: false,
              duration: 0,
              unsafe: null,
              error: message,
            })),
          ])
        }
      }
    } finally {
      setChecking(false)
      stopRef.current = false
    }
  }

  function stop() {
    stopRef.current = true
  }

  function exportCsv() {
    if (results.length === 0) return
    const headers = [
      t('table.slug'),
      t('table.url'),
      t('table.status'),
      t('table.verdict'),
      t('table.duration'),
      t('table.error'),
    ]
    const rows = results.map((r) => [
      r.slug,
      r.url,
      r.status ?? '',
      t(`verdict.${verdictOf(r)}`),
      r.duration,
      r.error ?? '',
    ])
    downloadFile({
      data: new Blob([generateCsv(headers, rows)], {
        type: 'text/csv;charset=utf-8',
      }),
      filename: `link-check-${Date.now()}.csv`,
    })
  }

  const counts = {
    all: results.length,
    ok: results.filter((r) => verdictOf(r) === 'ok').length,
    broken: results.filter((r) => verdictOf(r) === 'broken').length,
    unsafe: results.filter((r) => verdictOf(r) === 'unsafe').length,
  }
  const filtered =
    tab === 'all' ? results : results.filter((r) => verdictOf(r) === tab)

  const total = targets.length
  const checked = results.length
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0
  const stats: Record<(typeof STAT_KEYS)[number], number> = {
    total,
    checked,
    ok: counts.ok,
    broken: counts.broken,
    unsafe: counts.unsafe,
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="ring-1">
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="check-timeout">{t('config.timeout')}</Label>
              <Input
                id="check-timeout"
                type="number"
                min={1}
                max={30}
                value={timeout}
                onChange={(e) =>
                  setTimeoutValue(clamp(Number(e.target.value), 1, 30))
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('config.timeoutHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="check-batch">{t('config.batchSize')}</Label>
              <Input
                id="check-batch"
                type="number"
                min={1}
                max={MAX_BATCH}
                value={batchSize}
                onChange={(e) =>
                  setBatchSize(clamp(Number(e.target.value), 1, MAX_BATCH))
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('config.batchSizeHint')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void start()} disabled={checking}>
              <Play className="mr-1 size-4" />
              {checking ? t('actions.running') : t('actions.start')}
            </Button>
            <Button variant="destructive" onClick={stop} disabled={!checking}>
              <Square className="mr-1 size-4" />
              {t('actions.stop')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void loadLinks()}
              disabled={checking || loadingLinks}
            >
              <RefreshCw className="mr-1 size-4" />
              {t('actions.reload')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setResults([])}
              disabled={checking || results.length === 0}
            >
              <Trash2 className="mr-1 size-4" />
              {t('actions.clear')}
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={results.length === 0}
            >
              <Download className="mr-1 size-4" />
              {t('actions.exportCsv')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_KEYS.map((key) => (
          <Card key={key} size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {t(`stats.${key}`)}
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatNumber(stats[key], locale)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card size="sm">
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('progress.title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('progress.label', { checked, total })}
            </p>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('results.title')}</CardTitle>
          <CardDescription>{t('results.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              {TABS.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {t(`tabs.${key}`)} ({counts[key]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {checking ? t('actions.running') : t('empty')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.slug')}</TableHead>
                    <TableHead>{t('table.url')}</TableHead>
                    <TableHead className="w-20">{t('table.status')}</TableHead>
                    <TableHead className="w-24">{t('table.verdict')}</TableHead>
                    <TableHead className="w-20">
                      {t('table.duration')}
                    </TableHead>
                    <TableHead>{t('table.error')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const v = verdictOf(r)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">/{r.slug}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">
                          {r.url}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.status ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={BADGE[v]}>{t(`verdict.${v}`)}</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {r.duration ? `${r.duration}ms` : '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {r.error ?? '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
