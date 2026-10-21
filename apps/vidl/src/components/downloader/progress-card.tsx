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
import { Download, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  selectErrorNum,
  selectFinishNum,
  selectTargetSegment,
  useDownloadStore,
} from '@/stores/download-store'

interface ProgressCardProps {
  actions: {
    retry: (index: number) => Promise<void>
    forceDownload: () => Promise<void>
    saveTask: () => Promise<void>
  }
}

export function ProgressCard({ actions }: ProgressCardProps) {
  const t = useTranslations()

  const finishList = useDownloadStore((s) => s.finishList)
  const finishNum = useDownloadStore(selectFinishNum)
  const errorNum = useDownloadStore(selectErrorNum)
  const targetSegment = useDownloadStore(selectTargetSegment)
  const hasMediaData = useDownloadStore((s) => s.hasMediaData)
  const isReadyToSave = useDownloadStore((s) => s.isReadyToSave)

  return (
    <Card className="flex flex-col p-4 border-none h-full">
      <CardHeader className="p-0">
        <CardTitle>{t('progress.title')}</CardTitle>
        {finishList.length > 0 && (
          <CardDescription>
            {t('progress.totalSegments', { count: targetSegment })}
          </CardDescription>
        )}
        <CardAction>
          {finishList.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm space-x-2">
                <Badge variant="outline">
                  {t('progress.finished', { count: finishNum })}
                </Badge>
                {errorNum > 0 && (
                  <Badge variant="destructive">
                    {t('progress.failed', { count: errorNum })}
                  </Badge>
                )}
              </div>

              {isReadyToSave && (
                <Button size="sm" onClick={() => void actions.saveTask()}>
                  <Save className="size-4" />
                  {t('download.save')}
                </Button>
              )}

              {hasMediaData && !isReadyToSave && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void actions.forceDownload()}
                >
                  <Download className="size-4" />
                  {t('download.forceDownload')}
                </Button>
              )}
            </div>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-0 overflow-hidden">
        {finishList.length > 0 ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('progress.overall')}</span>
                <span className="font-medium">
                  {((finishNum / targetSegment) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={(finishNum / targetSegment) * 100}
                className="h-2.5"
              />
            </div>

            {errorNum > 0 && (
              <Alert variant="destructive">
                <AlertTitle>{t('progress.partialFailed')}</AlertTitle>
                <AlertDescription>{t('progress.retryHint')}</AlertDescription>
              </Alert>
            )}

            <div className="flex-1">
              <TooltipProvider>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] p-0.5 gap-2">
                  {finishList.map((item, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: no unique identifier available
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => void actions.retry(index)}
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
                          {item.title ||
                            t('progress.segment', { index: index + 1 })}
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
          </>
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
