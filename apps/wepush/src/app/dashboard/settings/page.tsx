'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Checkbox } from '@cdlab/ui/components/checkbox'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import { Separator } from '@cdlab/ui/components/separator'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { Switch } from '@cdlab/ui/components/switch'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SubHeader } from '@/components/layout'
import type { User, UserConfig } from '@/database/schema'

// GET /api/settings masks secrets and adds presence flags; PATCH on regenerate
// returns the full row (so the new pushApiToken can be displayed once).
type SettingsResponse = UserConfig & {
  hasWechatAppSecret?: boolean
  hasPushApiToken?: boolean
}

type SettingsPatch = Partial<{
  wechatAppId: string
  wechatAppSecret: string
  defaultWechatTemplateId: string
  maxPushOneMinute: number
  sleepTime: number
  apiTimeout: number
  maxRetries: number
  retryDelay: number
  cronEnabled: boolean
  cronUserIds: string[]
  regeneratePushApiToken: boolean
}>

async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to load settings')
  return res.json()
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users?limit=200&offset=0')
  if (!res.ok) throw new Error('Failed to load users')
  const data = (await res.json()) as { rows: User[] }
  return data.rows
}

async function patchSettings(patch: SettingsPatch): Promise<SettingsResponse> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to save settings')
  return res.json()
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  // Same query key used by other pages (users list / template form) so this
  // shares cache with /users and stays in sync when users are added/removed.
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  const [form, setForm] = useState<SettingsPatch>({})

  useEffect(() => {
    if (!data) return
    setForm({
      wechatAppId: data.wechatAppId,
      // wechatAppSecret is never returned cleartext; leave empty unless the
      // user types a new value (server treats empty as "keep existing").
      wechatAppSecret: '',
      defaultWechatTemplateId: data.defaultWechatTemplateId,
      maxPushOneMinute: data.maxPushOneMinute,
      sleepTime: data.sleepTime,
      apiTimeout: data.apiTimeout,
      maxRetries: data.maxRetries,
      retryDelay: data.retryDelay,
      cronEnabled: data.cronEnabled,
      cronUserIds: data.cronUserIds,
    })
  }, [data])

  const save = useMutation({
    mutationFn: patchSettings,
    onSuccess: (fresh) => {
      qc.setQueryData(['settings'], fresh)
      toast.success('已保存')
    },
    onError: () => toast.error('保存失败'),
  })

  const regen = useMutation({
    mutationFn: () => patchSettings({ regeneratePushApiToken: true }),
    onSuccess: (fresh) => {
      qc.setQueryData(['settings'], fresh)
      toast.success('已生成新 token')
    },
    onError: () => toast.error('生成失败'),
  })

  const copyToken = async () => {
    if (!data?.pushApiToken) return
    await navigator.clipboard.writeText(data.pushApiToken)
    toast.success('已复制 token')
  }

  const selectedCronUsers = useMemo(
    () => new Set(form.cronUserIds ?? []),
    [form.cronUserIds],
  )

  if (isLoading || !data) {
    return (
      <>
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-10 w-full max-w-sm" />
            </div>
          ))}
        </div>
      </>
    )
  }

  const set =
    <K extends keyof SettingsPatch>(key: K) =>
    (value: SettingsPatch[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }))

  const toggleCronUser = (id: string, checked: boolean) => {
    const next = new Set(selectedCronUsers)
    if (checked) next.add(id)
    else next.delete(id)
    set('cronUserIds')([...next])
  }

  const selectAllEnabledUsers = () =>
    set('cronUserIds')(users.filter((u) => u.enabled).map((u) => u.id))

  const clearCronUsers = () => set('cronUserIds')([])

  return (
    <>
      <SubHeader
        title="全局配置"
        description="微信 / 节流参数 / 推送触发 token"
      />

      <Section
        id="wechat"
        title="微信测试号"
        desc="申请测试号后填写 APP_ID 与 APP_SECRET，并指定默认模板 ID。"
      >
        <TextField
          label="APP_ID"
          value={form.wechatAppId ?? ''}
          onChange={set('wechatAppId')}
        />
        <TextField
          label="APP_SECRET"
          value={form.wechatAppSecret ?? ''}
          onChange={set('wechatAppSecret')}
          type="password"
          placeholder={
            data.hasWechatAppSecret ? '已配置，留空保持不变' : '尚未配置'
          }
        />
        <TextField
          label="默认模板 ID"
          value={form.defaultWechatTemplateId ?? ''}
          onChange={set('defaultWechatTemplateId')}
        />
      </Section>

      <Separator className="my-8" />

      <Section id="throttle" title="节流参数" desc="控制推送速率与重试策略。">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="每分钟最大推送数"
            value={form.maxPushOneMinute ?? 5}
            onChange={set('maxPushOneMinute')}
          />
          <NumberField
            label="节流暂停毫秒"
            value={form.sleepTime ?? 65000}
            onChange={set('sleepTime')}
          />
          <NumberField
            label="API 超时毫秒"
            value={form.apiTimeout ?? 10000}
            onChange={set('apiTimeout')}
          />
          <NumberField
            label="最大重试次数"
            value={form.maxRetries ?? 3}
            onChange={set('maxRetries')}
          />
          <NumberField
            label="重试基础延迟毫秒"
            value={form.retryDelay ?? 2000}
            onChange={set('retryDelay')}
          />
        </div>
      </Section>

      <Separator className="my-8" />

      <Section
        id="token"
        title="HTTP 触发 token"
        desc="调用 POST /api/push/run 时通过 Authorization: Bearer <token> 鉴权。生成后仅本次会话可见，刷新页面后将再次隐藏。"
      >
        <div className="flex items-center gap-2">
          <Input
            value={data.pushApiToken}
            readOnly
            className="font-mono"
            placeholder={
              data.hasPushApiToken ? '已配置，点右侧按钮可重置' : '尚未配置'
            }
          />
          <Button
            variant="outline"
            size="icon"
            disabled={!data.pushApiToken}
            onClick={() => void copyToken()}
            aria-label="复制 token"
          >
            <Copy className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={regen.isPending}
            onClick={() => regen.mutate()}
            aria-label="生成新 token"
          >
            <RefreshCcw className="size-4" />
          </Button>
        </div>
      </Section>

      <Separator className="my-8" />

      <Section
        id="cron"
        title="定时触发"
        desc="由 Worker scheduled() 在 wrangler.jsonc 配置的 cron 时间触发。"
      >
        <div className="flex items-center gap-3">
          <Switch
            checked={form.cronEnabled ?? false}
            onCheckedChange={set('cronEnabled')}
            id="cron-enabled"
          />
          <Label htmlFor="cron-enabled">启用定时推送</Label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>参与用户</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAllEnabledUsers}
                disabled={users.length === 0}
              >
                全选已启用
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCronUsers}
                disabled={(form.cronUserIds ?? []).length === 0}
              >
                清空
              </Button>
            </div>
          </div>

          {users.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              尚无接收人。先去{' '}
              <Link href="/dashboard/users" className="underline">
                /users
              </Link>{' '}
              添加。
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
              {users.map((u) => {
                const checkboxId = `cron-user-${u.id}`
                return (
                  <div key={u.id} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId}
                      checked={selectedCronUsers.has(u.id)}
                      onCheckedChange={(c) => toggleCronUser(u.id, c === true)}
                    />
                    <Label
                      htmlFor={checkboxId}
                      className="flex flex-1 cursor-pointer items-center gap-2 font-normal"
                    >
                      <span
                        className={u.enabled ? '' : 'text-muted-foreground'}
                      >
                        {u.name || u.wechatOpenId || u.id}
                      </span>
                      {!u.enabled ? (
                        <Badge variant="outline" className="text-[10px]">
                          已禁用
                        </Badge>
                      ) : null}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            未勾选的用户不会进入定时推送。被禁用的用户即便勾选也会在推送时跳过。
          </p>
        </div>
      </Section>

      <div className="mt-10 flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => data && setForm({ ...data })}
          disabled={save.isPending}
        >
          重置
        </Button>
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
          {save.isPending ? '保存中...' : '保存'}
        </Button>
      </div>
    </>
  )
}

function Section({
  id,
  title,
  desc,
  children,
}: {
  /** Anchor the 设置 space panel links to (`/dashboard/settings#<id>`). */
  id: string
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    // scroll-mt clears the sticky page header when jumping to the anchor.
    <section id={id} className="scroll-mt-16">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc ? (
        <p className="mt-1 mb-4 text-sm text-muted-foreground">{desc}</p>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password'
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) ? n : 0)
        }}
      />
    </div>
  )
}
