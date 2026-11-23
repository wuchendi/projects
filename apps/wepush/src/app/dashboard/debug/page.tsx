'use client'

import { Button } from '@cdlab/ui/components/button'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Spinner } from '@cdlab/ui/components/spinner'
import { useMutation } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { SubHeader } from '@/components/layout'

type SourceName = 'weather' | 'hitokoto' | 'iciba'

interface SourceMeta {
  value: SourceName
  label: string
  needsCityCode?: boolean
}

const SOURCES: SourceMeta[] = [
  { value: 'weather', label: '基础天气 (itboy.net)', needsCityCode: true },
  { value: 'hitokoto', label: '每日一言' },
  { value: 'iciba', label: 'iCIBA 每日一句' },
]

async function callSource(name: SourceName, params: { cityCode?: string }) {
  const sp = new URLSearchParams()
  if (params.cityCode) sp.set('cityCode', params.cityCode)
  const res = await fetch(`/api/debug/source/${name}?${sp.toString()}`)
  const data = await res.json<{ error?: string } & Record<string, unknown>>()
  if (!res.ok) throw new Error(data?.error || `请求失败 (${res.status})`)
  return data
}

export default function DebugPage() {
  const [name, setName] = useState<SourceName>('hitokoto')
  const [cityCode, setCityCode] = useState('101010100')

  const meta = SOURCES.find((s) => s.value === name) as SourceMeta

  const call = useMutation({
    mutationFn: () =>
      callSource(name, {
        cityCode: meta.needsCityCode ? cityCode : undefined,
      }),
  })

  return (
    <>
      <SubHeader
        title="数据源探测"
        description="直接调用单个外部接口，查看原始返回。"
      />

      <div className="mb-6 space-y-4 rounded-lg bg-card p-5">
        <div className="space-y-1.5">
          <Label className="text-xs">数据源</Label>
          <Select
            items={SOURCES}
            value={name}
            onValueChange={(v) => {
              if (v !== null) setName(v)
            }}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {meta.needsCityCode ? (
          <div className="space-y-1.5">
            <Label className="text-xs">城市编码</Label>
            <Input
              value={cityCode}
              onChange={(e) => setCityCode(e.target.value)}
              placeholder="如 101010100"
              className="w-full sm:w-80 font-mono"
            />
          </div>
        ) : null}

        <Button onClick={() => call.mutate()} disabled={call.isPending}>
          {call.isPending ? (
            <Spinner className="mr-1 size-4" />
          ) : (
            <Play className="mr-1 size-4" />
          )}
          调用
        </Button>
      </div>

      {call.error ? (
        <pre className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
          {call.error.message}
        </pre>
      ) : null}

      {call.data ? (
        <div className="rounded-lg bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            响应
          </h3>
          <pre className="overflow-x-auto text-xs">
            {JSON.stringify(call.data, null, 2)}
          </pre>
        </div>
      ) : null}
    </>
  )
}
