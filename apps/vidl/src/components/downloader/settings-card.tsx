'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@cdlab/ui/components/dialog'
import { Field, FieldTitle } from '@cdlab/ui/components/field'
import { Slider } from '@cdlab/ui/components/slider'
import { RotateCcw, Settings2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSettingsStore } from '@/stores/settings-store'

export function SettingsDialog() {
  const t = useTranslations()
  const maxTasks = useSettingsStore((s) => s.maxTasks)
  const concurrency = useSettingsStore((s) => s.concurrency)
  const timeoutMs = useSettingsStore((s) => s.timeoutMs)
  const maxRetries = useSettingsStore((s) => s.maxRetries)
  const retryBaseDelayMs = useSettingsStore((s) => s.retryBaseDelayMs)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const resetSettings = useSettingsStore((s) => s.resetSettings)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm">
          <Settings2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Field>
            <div className="flex items-center justify-between">
              <FieldTitle>{t('settings.maxTasks')}</FieldTitle>
              <span className="text-sm font-medium tabular-nums">
                {maxTasks}
              </span>
            </div>
            <Slider
              value={[maxTasks]}
              onValueChange={([v]) => setSettings({ maxTasks: v })}
              min={1}
              max={5}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.maxTasksHint')}
            </p>
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldTitle>{t('settings.concurrency')}</FieldTitle>
              <span className="text-sm font-medium tabular-nums">
                {concurrency}
              </span>
            </div>
            <Slider
              value={[concurrency]}
              onValueChange={([v]) => setSettings({ concurrency: v })}
              min={1}
              max={20}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.concurrencyHint')}
            </p>
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldTitle>{t('settings.timeout')}</FieldTitle>
              <span className="text-sm font-medium tabular-nums">
                {timeoutMs / 1000}s
              </span>
            </div>
            <Slider
              value={[timeoutMs / 1000]}
              onValueChange={([v]) => setSettings({ timeoutMs: v * 1000 })}
              min={5}
              max={120}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.timeoutHint')}
            </p>
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldTitle>{t('settings.maxRetries')}</FieldTitle>
              <span className="text-sm font-medium tabular-nums">
                {maxRetries}
              </span>
            </div>
            <Slider
              value={[maxRetries]}
              onValueChange={([v]) => setSettings({ maxRetries: v })}
              min={0}
              max={10}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.maxRetriesHint')}
            </p>
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldTitle>{t('settings.retryDelay')}</FieldTitle>
              <span className="text-sm font-medium tabular-nums">
                {retryBaseDelayMs / 1000}s
              </span>
            </div>
            <Slider
              value={[retryBaseDelayMs / 1000]}
              onValueChange={([v]) =>
                setSettings({ retryBaseDelayMs: v * 1000 })
              }
              min={0.5}
              max={10}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.retryDelayHint')}
            </p>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={resetSettings}>
            <RotateCcw className="size-4" />
            {t('settings.reset')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
