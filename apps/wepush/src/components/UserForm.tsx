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
import { Separator } from '@cdlab/ui/components/separator'
import { Switch } from '@cdlab/ui/components/switch'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CityCodePicker } from '@/components/CityCodePicker'
import { DatePicker } from '@/components/DatePicker'
import { MonthDayPicker } from '@/components/MonthDayPicker'
import type { CustomDate, Festival, Template, User } from '@/database/schema'

export interface UserFormValue {
  name: string
  wechatOpenId: string
  wechatTemplateId: string
  templateCode: string
  city: string
  weatherCityCode: string
  horoscopeDate: string | null
  showColor: boolean
  enabled: boolean
  festivals: Array<{ name: string; date: string; isLunar: boolean }>
  customDates: Array<{ keyword: string; date: string }>
}

type FormState = Omit<UserFormValue, 'festivals' | 'customDates'> & {
  festivals: Array<{
    _key: string
    name: string
    date: string
    isLunar: boolean
  }>
  customDates: Array<{ _key: string; keyword: string; date: string }>
}

function rowKey(): string {
  return crypto.randomUUID()
}

interface Props {
  initial?: User & { festivals?: Festival[]; customDates?: CustomDate[] }
  templates: Template[]
  submitting?: boolean
  onSubmit: (value: UserFormValue) => void
  onCancel?: () => void
}

function emptyValue(): FormState {
  return {
    name: '',
    wechatOpenId: '',
    wechatTemplateId: '',
    templateCode: '',
    city: '',
    weatherCityCode: '',
    horoscopeDate: null,
    showColor: true,
    enabled: true,
    festivals: [],
    customDates: [],
  }
}

export function UserForm({
  initial,
  templates,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState<FormState>(() => {
    if (!initial) return emptyValue()
    return {
      name: initial.name,
      wechatOpenId: initial.wechatOpenId,
      wechatTemplateId: initial.wechatTemplateId,
      templateCode: initial.templateCode,
      city: initial.city,
      weatherCityCode: initial.weatherCityCode,
      horoscopeDate: initial.horoscopeDate ?? null,
      showColor: initial.showColor,
      enabled: initial.enabled,
      festivals:
        initial.festivals?.map((f) => ({
          _key: rowKey(),
          name: f.name,
          date: f.date,
          isLunar: !!f.isLunar,
        })) ?? [],
      customDates:
        initial.customDates?.map((d) => ({
          _key: rowKey(),
          keyword: d.keyword,
          date: d.date,
        })) ?? [],
    }
  })

  const set =
    <K extends keyof FormState>(key: K) =>
    (v: FormState[K]) =>
      setValue((prev) => ({ ...prev, [key]: v }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          ...value,
          festivals: value.festivals.map(({ name, date, isLunar }) => ({
            name,
            date,
            isLunar,
          })),
          customDates: value.customDates.map(({ keyword, date }) => ({
            keyword,
            date,
          })),
        })
      }}
      className="space-y-8"
    >
      <Section title="基本信息">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="昵称">
            <Input
              value={value.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="用于日志区分"
            />
          </Field>
          <Field label="状态">
            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={value.enabled}
                onCheckedChange={set('enabled')}
                id="user-enabled"
              />
              <Label htmlFor="user-enabled">
                {value.enabled ? '启用' : '停用'}
              </Label>
            </div>
          </Field>
        </div>
      </Section>

      <Separator />

      <Section title="微信测试号">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="OpenID">
            <Input
              value={value.wechatOpenId}
              onChange={(e) => set('wechatOpenId')(e.target.value)}
            />
          </Field>
          <Field label="微信模板 ID">
            <Input
              value={value.wechatTemplateId}
              onChange={(e) => set('wechatTemplateId')(e.target.value)}
              placeholder="留空则用全局默认"
            />
          </Field>
          <Field label="关联本地模板（code）">
            <Select
              items={templates.map((t) => ({
                value: t.code,
                label: `${t.code} ${t.title ? `· ${t.title}` : ''}`,
              }))}
              value={value.templateCode || null}
              onValueChange={(v) => {
                if (v !== null) set('templateCode')(v)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择模板..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.code} {t.title ? `· ${t.title}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="多彩颜色">
            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={value.showColor}
                onCheckedChange={set('showColor')}
                id="user-color"
              />
              <Label htmlFor="user-color">
                {value.showColor ? '启用' : '关闭'}
              </Label>
            </div>
          </Field>
        </div>
      </Section>

      <Separator />

      <Section title="天气 / 星座">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="城市">
            <Input
              value={value.city}
              onChange={(e) => set('city')(e.target.value)}
              placeholder="如 北京"
            />
          </Field>
          <Field label="基础天气城市编码">
            <CityCodePicker
              value={value.weatherCityCode}
              onChange={(v) => set('weatherCityCode')(v)}
              placeholder="9 位编码，或点右侧搜索"
            />
          </Field>
          <Field label="星座日期 (月-日)">
            <MonthDayPicker
              value={value.horoscopeDate ?? ''}
              onChange={(v) => set('horoscopeDate')(v || null)}
              className="w-full"
            />
          </Field>
        </div>
      </Section>

      <Separator />

      <Section
        title="纪念日"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setValue((p) => ({
                ...p,
                festivals: [
                  ...p.festivals,
                  { _key: rowKey(), name: '', date: '', isLunar: false },
                ],
              }))
            }
          >
            <Plus className="mr-1 size-4" />
            添加
          </Button>
        }
      >
        {value.festivals.length === 0 ? (
          <p className="text-sm text-muted-foreground">无</p>
        ) : (
          <div className="space-y-2">
            {value.festivals.map((f, i) => (
              <div key={f._key} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="名称 如 生日"
                  value={f.name}
                  onChange={(e) =>
                    setValue((p) => ({
                      ...p,
                      festivals: p.festivals.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    }))
                  }
                />
                <MonthDayPicker
                  className="w-36"
                  value={f.date}
                  onChange={(v) =>
                    setValue((p) => ({
                      ...p,
                      festivals: p.festivals.map((x, j) =>
                        j === i ? { ...x, date: v } : x,
                      ),
                    }))
                  }
                />
                <div className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5">
                  <Switch
                    id={`festival-lunar-${f._key}`}
                    checked={f.isLunar}
                    onCheckedChange={(checked) =>
                      setValue((p) => ({
                        ...p,
                        festivals: p.festivals.map((x, j) =>
                          j === i ? { ...x, isLunar: checked } : x,
                        ),
                      }))
                    }
                  />
                  <Label
                    htmlFor={`festival-lunar-${f._key}`}
                    className="cursor-pointer text-xs"
                  >
                    农历
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setValue((p) => ({
                      ...p,
                      festivals: p.festivals.filter((_, j) => j !== i),
                    }))
                  }
                  aria-label="删除"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Separator />

      <Section
        title="累计日（自定义关键词）"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setValue((p) => ({
                ...p,
                customDates: [
                  ...p.customDates,
                  { _key: rowKey(), keyword: '', date: '' },
                ],
              }))
            }
          >
            <Plus className="mr-1 size-4" />
            添加
          </Button>
        }
      >
        {value.customDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            如 love_day = 2020-01-01，可在模板中用 {`{{love_day.DATA}}`}{' '}
            显示天数，{`{{love_day_date.DATA}}`} 显示日期
          </p>
        ) : (
          <div className="space-y-2">
            {value.customDates.map((d, i) => (
              <div key={d._key} className="flex items-center gap-2">
                <Input
                  className="flex-1 font-mono"
                  placeholder="keyword 如 love_day"
                  value={d.keyword}
                  onChange={(e) =>
                    setValue((p) => ({
                      ...p,
                      customDates: p.customDates.map((x, j) =>
                        j === i ? { ...x, keyword: e.target.value } : x,
                      ),
                    }))
                  }
                />
                <DatePicker
                  className="w-44"
                  value={d.date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(v) =>
                    setValue((p) => ({
                      ...p,
                      customDates: p.customDates.map((x, j) =>
                        j === i ? { ...x, date: v } : x,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setValue((p) => ({
                      ...p,
                      customDates: p.customDates.filter((_, j) => j !== i),
                    }))
                  }
                  aria-label="删除"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Separator />

      <div className="flex justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  actions,
  children,
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
