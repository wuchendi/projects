'use client'

import { IconButton } from '@cdlab/ui/shell/layout/icon-button'
import {
  PanelFrame,
  PanelRow,
  PanelSection,
} from '@cdlab/ui/shell/layout/panel'
import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  List,
  MessageSquare,
  Plus,
  Timer,
  Users,
  XCircle,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ComponentType } from 'react'
import { fetchTemplates, fetchUsers } from '@/lib/queries'

// The shell's space panels: the column beside a space's pages. Rows are links
// (query / hash included), so a page reads its filter from the URL.

function UsersPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const template = useSearchParams().get('template')
  const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers }).data
  const templates =
    useQuery({ queryKey: ['templates'], queryFn: fetchTemplates }).data ?? []
  const onList = pathname === '/dashboard/users'

  const countFor = (code: string) =>
    users?.filter((u) => u.templateCode === code).length

  return (
    <PanelFrame
      title="接收人"
      actions={
        <IconButton
          label="新建接收人"
          icon={Plus}
          onClick={() => router.push('/dashboard/users/new')}
        />
      }
    >
      <PanelSection label="视图">
        <PanelRow
          href="/dashboard/users"
          icon={Users}
          count={users?.length}
          active={onList && !template}
        >
          全部接收人
        </PanelRow>
      </PanelSection>
      {templates.length > 0 && (
        <PanelSection label="按模板">
          {templates.map((t) => (
            <PanelRow
              key={t.id}
              href={`/dashboard/users?template=${encodeURIComponent(t.code)}`}
              icon={FileText}
              count={countFor(t.code)}
              title={t.code}
              active={onList && template === t.code}
            >
              {t.title || t.code}
            </PanelRow>
          ))}
        </PanelSection>
      )}
    </PanelFrame>
  )
}

function TemplatesPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const templates =
    useQuery({ queryKey: ['templates'], queryFn: fetchTemplates }).data ?? []

  return (
    <PanelFrame
      title="模板"
      actions={
        <IconButton
          label="新建模板"
          icon={Plus}
          onClick={() => router.push('/dashboard/templates/new')}
        />
      }
    >
      <PanelSection label="视图">
        <PanelRow
          href="/dashboard/templates"
          icon={List}
          count={templates.length}
          active={pathname === '/dashboard/templates'}
        >
          全部模板
        </PanelRow>
      </PanelSection>
      {templates.length > 0 && (
        <PanelSection label="模板">
          {templates.map((t) => (
            <PanelRow
              key={t.id}
              href={`/dashboard/templates/${t.id}`}
              icon={FileText}
              title={t.code}
              active={pathname === `/dashboard/templates/${t.id}`}
            >
              {t.title || t.code}
            </PanelRow>
          ))}
        </PanelSection>
      )}
    </PanelFrame>
  )
}

const LOG_VIEWS: {
  status: 'success' | 'failed' | null
  label: string
  icon: LucideIcon
}[] = [
  { status: null, label: '全部日志', icon: List },
  { status: 'success', label: '成功', icon: CheckCircle2 },
  { status: 'failed', label: '失败', icon: XCircle },
]

function LogsPanel() {
  const pathname = usePathname()
  const status = useSearchParams().get('status')
  const onList = pathname === '/dashboard/logs'

  return (
    <PanelFrame title="日志">
      <PanelSection label="视图">
        {LOG_VIEWS.map((v) => (
          <PanelRow
            key={v.label}
            href={
              v.status
                ? `/dashboard/logs?status=${v.status}`
                : '/dashboard/logs'
            }
            icon={v.icon}
            active={onList && (status ?? null) === v.status}
          >
            {v.label}
          </PanelRow>
        ))}
      </PanelSection>
    </PanelFrame>
  )
}

const SETTINGS_SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'wechat', label: '微信测试号', icon: MessageSquare },
  { id: 'throttle', label: '节流参数', icon: Timer },
  { id: 'token', label: 'HTTP 触发 token', icon: KeyRound },
  { id: 'cron', label: '定时触发', icon: Clock },
]

function SettingsPanel() {
  return (
    <PanelFrame title="设置">
      <PanelSection label="全局配置">
        {SETTINGS_SECTIONS.map((s) => (
          <PanelRow
            key={s.id}
            href={`/dashboard/settings#${s.id}`}
            icon={s.icon}
          >
            {s.label}
          </PanelRow>
        ))}
      </PanelSection>
    </PanelFrame>
  )
}

/** Panels by space key; 概览 and 探测 are single pages without one. */
export const SPACE_PANELS: Partial<Record<string, ComponentType>> = {
  users: UsersPanel,
  templates: TemplatesPanel,
  logs: LogsPanel,
  settings: SettingsPanel,
}
