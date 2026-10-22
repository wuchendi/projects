'use client'

import { Alert, AlertDescription, AlertTitle } from '@cdlab/ui/components/alert'
import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Progress } from '@cdlab/ui/components/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { IKEmpty } from '@cdlab/ui/IK'
import { cn } from '@cdlab/ui/lib/utils'
import {
  ChevronDown,
  Download,
  Pause,
  Play,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useStore } from 'zustand'
import { taskManager, useQueueUi } from '@/lib/task-manager'
import {
  createDownloadStore,
  selectErrorNum,
  selectFinishNum,
  selectTargetSegment,
} from '@/stores/download-store'
import type { TaskRecord, TaskStatus } from '@/stores/task-store'
import { useTaskStore } from '@/stores/task-store'

// useStore needs a store before a task's runtime exists (first render).
const emptyStore = createDownloadStore()

const STATUS_BADGE: Record<
  TaskStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  queued: 'outline',
  downloading: 'default',
  paused: 'secondary',
  error: 'destructive',
  ready: 'default',
  saved: 'secondary',
}

function displayName(task: TaskRecord): string {
  if (task.customFileName) return task.customFileName
  if (task.title) return task.title
  try {
    const url = new URL(task.url)
    return url.pathname.split('/').filter(Boolean).pop() || url.host
  } catch {
    return task.url
  }
}

function TaskRow({ task }: { task: TaskRecord }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const runtime = taskManager.getRuntime(task.id)
  useQueueUi((s) => s.runtimeVersion) // re-render when this tab takes or drops a task
  const foreign = !runtime

  const finishNum = useStore(
    runtime?.store ?? emptyStore,
    runtime ? selectFinishNum : () => 0,
  )
  const errorNum = useStore(
    runtime?.store ?? emptyStore,
    runtime ? selectErrorNum : () => 0,
  )
  const target = useStore(
    runtime?.store ?? emptyStore,
    runtime ? selectTargetSegment : () => 0,
  )
  const percent = target > 0 ? (finishNum / target) * 100 : 0

  const { status } = task
  const busy = status === 'downloading' || status === 'queued'

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 py-2 px-3 bg-muted/30">
        <span className="truncate flex-1 text-sm font-medium">
          {displayName(task)}
        </span>
        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
          {task.isGetMP4 ? 'MP4' : 'TS'}
          {task.saveAsStream ? ' · stream' : ''}
        </Badge>
        <Badge variant={STATUS_BADGE[status]} className="shrink-0">
          {t(`tasks.status.${status}`)}
        </Badge>
      </div>

      <div className="px-3 py-2 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {finishNum} / {target}
            {errorNum > 0 && (
              <span className="text-red-500 ml-2">
                {t('progress.failed', { count: errorNum })}
              </span>
            )}
          </span>
          <span className="tabular-nums">{percent.toFixed(1)}%</span>
        </div>
        <Progress value={percent} className="h-1.5" />

        <div className="flex flex-wrap items-center gap-2">
          {foreign ? (
            <span className="text-xs text-muted-foreground">
              {t('tasks.otherTab')}
            </span>
          ) : (
            <>
              {busy && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => taskManager.pause(task.id)}
                >
                  <Pause className="size-4" />
                  {t('download.pause')}
                </Button>
              )}
              {(status === 'paused' || status === 'error') && (
                <Button size="sm" onClick={() => taskManager.resume(task.id)}>
                  {status === 'error' ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {status === 'error' ? t('tasks.retry') : t('download.resume')}
                </Button>
              )}
              {status === 'ready' && (
                <Button
                  size="sm"
                  onClick={() => void taskManager.save(task.id)}
                >
                  <Save className="size-4" />
                  {t('download.save')}
                </Button>
              )}
              {status === 'saved' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void taskManager.cancel(task.id)}
                >
                  <Trash2 className="size-4" />
                  {t('tasks.remove')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void taskManager.cancel(task.id)}
                >
                  <X className="size-4" />
                  {status === 'ready'
                    ? t('tasks.remove')
                    : t('download.cancel')}
                </Button>
              )}
            </>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                open && 'rotate-180',
              )}
            />
          </Button>
        </div>
      </div>

      {open && runtime && <SegmentGrid taskId={task.id} />}
    </div>
  )
}

function SegmentGrid({ taskId }: { taskId: string }) {
  const t = useTranslations()
  const runtime = taskManager.getRuntime(taskId)
  const finishList = useStore(runtime?.store ?? emptyStore, (s) => s.finishList)
  const errorNum = useStore(runtime?.store ?? emptyStore, selectErrorNum)
  const hasMediaData = useStore(
    runtime?.store ?? emptyStore,
    (s) => s.hasMediaData,
  )
  const isReadyToSave = useStore(
    runtime?.store ?? emptyStore,
    (s) => s.isReadyToSave,
  )

  return (
    <div className="border-t px-3 py-3 space-y-3">
      {errorNum > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{t('progress.partialFailed')}</AlertTitle>
          <AlertDescription>{t('progress.retryHint')}</AlertDescription>
        </Alert>
      )}
      {hasMediaData && !isReadyToSave && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void taskManager.forceDownload(taskId)}
        >
          <Download className="size-4" />
          {t('download.forceDownload')}
        </Button>
      )}
      <TooltipProvider>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] p-0.5 gap-2">
          {finishList.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: no unique identifier available
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void taskManager.retrySegment(taskId, index)}
                  disabled={item.status !== 'error'}
                  className={cn(
                    'aspect-square rounded-md border font-medium',
                    'text-xs sm:text-sm',
                    'transition-all duration-150 shadow-sm',
                    'flex items-center justify-center',
                    item.status === 'finish' &&
                      'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white',
                    item.status === 'error' &&
                      'bg-red-600 hover:bg-red-700 border-red-700 text-white cursor-pointer hover:scale-105',
                    item.status === 'downloading' &&
                      'bg-blue-600 animate-pulse border-blue-700 text-white',
                    item.status === '' &&
                      'bg-muted hover:bg-muted/80 border-border text-muted-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {index + 1}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs wrap-break-word">
                  {item.title || t('progress.segment', { index: index + 1 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.status === 'finish'
                    ? t('progress.statusFinish')
                    : item.status === 'error'
                      ? t('progress.statusError')
                      : item.status === 'downloading'
                        ? t('progress.statusDownloading')
                        : t('progress.statusPending')}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}

export function TaskListCard() {
  const t = useTranslations()
  const tasks = useTaskStore((s) => s.tasks)
  const ready = useQueueUi((s) => s.ready)
  const list = Object.values(tasks).sort((a, b) => a.order - b.order)
  const active = list.filter(
    (task) => task.status === 'downloading' || task.status === 'queued',
  ).length
  const resumable = list.filter(
    (task) => task.status === 'paused' || task.status === 'error',
  ).length
  const saved = list.filter((task) => task.status === 'saved').length

  return (
    <Card className="flex flex-col p-4 border-none">
      <CardHeader className="p-0">
        <CardTitle>{t('tasks.title')}</CardTitle>
        {list.length > 0 && (
          <CardDescription>
            {t('tasks.count', { count: list.length })}
          </CardDescription>
        )}
        <CardAction>
          <div className="flex items-center gap-2 flex-wrap">
            {resumable > 0 && (
              <Button size="sm" onClick={() => taskManager.resumeAll()}>
                <Play className="size-4" />
                {t('tasks.resumeAll')}
              </Button>
            )}
            {active > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => taskManager.pauseAll()}
              >
                <Pause className="size-4" />
                {t('tasks.pauseAll')}
              </Button>
            )}
            {saved > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void taskManager.clearFinished()}
              >
                <Trash2 className="size-4" />
                {t('batch.clearDone')}
              </Button>
            )}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-0">
        {list.length > 0 && ready ? (
          list.map((task) => <TaskRow key={task.id} task={task} />)
        ) : (
          <IKEmpty
            title={t('empty.title')}
            description={t('empty.description')}
            hint={t('empty.hint')}
            icon={Download}
          />
        )}
      </CardContent>
    </Card>
  )
}
