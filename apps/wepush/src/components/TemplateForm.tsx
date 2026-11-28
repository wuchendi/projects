'use client'

import { Badge } from '@cdlab/ui/components/badge'
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
import { Separator } from '@cdlab/ui/components/separator'
import { Textarea } from '@cdlab/ui/components/textarea'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Eye, Send } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { PreviewResult } from '@/components/PreviewDialog'
import { PreviewDialog } from '@/components/PreviewDialog'
import type { Template, User } from '@/database/schema'
import { TEMPLATE_VARIABLES } from '@/lib/template-variables'

export interface TemplateFormValue {
  code: string
  title: string
  desc: string
}

interface Props {
  initial?: Template
  submitting?: boolean
  onSubmit: (value: TemplateFormValue) => void
  onCancel?: () => void
}

const VARIABLE_LABELS: Record<string, string> = Object.fromEntries(
  TEMPLATE_VARIABLES.map((v) => [v.name, v.label]),
)

function structurePreview(text: string): string {
  return text.replace(/\{\{([^}]+)\.DATA\}\}/g, (_match, name: string) => {
    const label = VARIABLE_LABELS[name]
    return label ? `【${label}】` : `【${name}】`
  })
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users?limit=200&offset=0')
  if (!res.ok) throw new Error('Failed to load users')
  const data = (await res.json()) as { rows: User[] }
  return data.rows
}

export function TemplateForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [desc, setDesc] = useState(initial?.desc ?? '')
  const descRef = useRef<HTMLTextAreaElement>(null)

  const [previewUserId, setPreviewUserId] = useState<string>('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const { data: usersList } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  const titlePreview = useMemo(() => structurePreview(title), [title])
  const descPreview = useMemo(() => structurePreview(desc), [desc])

  const renderMutation = useMutation({
    mutationFn: async (): Promise<PreviewResult> => {
      if (!previewUserId) throw new Error('请选择预览用户')
      const res = await fetch('/api/push/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: previewUserId,
          templateCode: code || undefined,
          title,
          desc,
        }),
      })
      if (!res.ok) {
        const d = await res
          .json<{ error?: string }>()
          .catch<{ error?: string }>(() => ({}))
        throw new Error(d.error || `请求失败 (${res.status})`)
      }
      return res.json<PreviewResult>()
    },
  })

  const insertVar = (name: string) => {
    const placeholder = `{{${name}.DATA}}`
    const el = descRef.current
    if (!el) {
      setDesc((d) => d + placeholder)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = desc.slice(0, start) + placeholder + desc.slice(end)
    setDesc(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + placeholder.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ code, title, desc })
      }}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Code（唯一业务码）</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="如 morning / evening_report"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>标题</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="如 今日提醒"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label>内容（支持变量）</Label>
          <Textarea
            ref={descRef}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={14}
            className="font-mono text-sm"
            placeholder={'今天是：{{date.DATA}}\n城市：{{city.DATA}}\n...'}
          />
          <p className="text-xs text-muted-foreground">
            渲染后的内容每一行作为一个变量 {'{{c1.DATA}}'} 到 {'{{c30.DATA}}'}{' '}
            一并发送（最多 30
            行）：测试号后台模板每行写一个，再加上固定的开头或结尾文字（微信不允许模板只有变量），就不受
            600 字限制。
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">
              结构预览（变量名替换为标签）
            </Label>
            <Badge variant="outline" className="text-[10px]">
              实时
            </Badge>
          </div>
          <div className="min-h-[336px] rounded-md border bg-muted/30 p-3 text-sm">
            {title ? (
              <p className="mb-3 border-b pb-2 font-semibold">{titlePreview}</p>
            ) : null}
            <pre className="whitespace-pre-wrap font-sans">
              {descPreview || (
                <span className="text-muted-foreground">
                  输入模板内容后这里会显示结构…
                </span>
              )}
            </pre>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">点击插入变量：</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <Badge
              key={v.name}
              variant="secondary"
              className="cursor-pointer font-mono text-xs"
              onClick={() => insertVar(v.name)}
              title={`${v.label} · ${v.source}`}
            >
              {`{{${v.name}.DATA}}`}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-sm text-muted-foreground">
            真实预览：
          </Label>
          <Select
            items={usersList?.map((u) => ({
              value: u.id,
              label: u.name || u.wechatOpenId || u.id,
            }))}
            value={previewUserId || null}
            onValueChange={(v) => setPreviewUserId(v ?? '')}
            disabled={!usersList || usersList.length === 0}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="选择一个接收人" />
            </SelectTrigger>
            <SelectContent>
              {usersList?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.wechatOpenId || u.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!previewUserId || renderMutation.isPending}
            onClick={() => {
              setPreviewOpen(true)
              renderMutation.mutate()
            }}
          >
            <Eye className="mr-1 size-4" />
            渲染预览
          </Button>
        </div>
        <div className="flex gap-3">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting || !code}>
            <Send className="mr-1 size-4" />
            {submitting ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        loading={renderMutation.isPending}
        result={renderMutation.data}
        error={renderMutation.error?.message}
      />
    </form>
  )
}
