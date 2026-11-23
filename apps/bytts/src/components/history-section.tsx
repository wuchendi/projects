'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@cdlab/ui/components/alert-dialog'
import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { CopyButton } from '@cdlab/ui/components/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { WaveformPlayer } from '@cdlab/ui/components/waveform-player'
import {
  IKAssetFailed,
  IKAssetLoading,
  IKAssetRenderer,
  IKAudioAssetPlayer,
  IKEmpty,
  StatusEnum,
} from '@cdlab/ui/IK'
import type { ZipFileEntry } from '@cdlab/utils'
import { downloadFile, downloadFilesAsZip } from '@cdlab/utils'
import { Download, Eye, History, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { HistoryItem } from '@/store/useHistoryStore'
import { useHistoryStore } from '@/store/useHistoryStore'

function HistoryCard({ item }: { item: HistoryItem }) {
  const { removeHistory } = useHistoryStore()
  const [open, setOpen] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const isCompleted = item.status === StatusEnum.COMPLETED
  const displayName = item.name ?? `${item.id}_audio.mp3`

  useEffect(() => {
    if (!item.audioBlob) return
    const url = URL.createObjectURL(item.audioBlob)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [item.audioBlob])

  const downloadAudio = () => {
    if (!item.audioBlob) return
    const filename = displayName.endsWith('.mp3')
      ? displayName
      : `${displayName}.mp3`
    downloadFile({ data: item.audioBlob, filename })
    toast.success('音频下载成功！')
  }

  return (
    <>
      <div className="group relative rounded-lg overflow-hidden bg-muted transition-shadow duration-200 hover:ring-2 hover:ring-primary border">
        <div className="aspect-square relative flex items-center justify-center">
          <IKAssetRenderer
            status={item.status}
            renderLoading={() => <IKAssetLoading />}
            renderFailure={() => <IKAssetFailed error={item.error} />}
            renderSuccess={() =>
              audioUrl ? (
                <IKAudioAssetPlayer
                  audioUrl={audioUrl}
                  className="w-full h-full cursor-pointer"
                />
              ) : null
            }
          />
        </div>

        <div className="absolute top-2 right-2 flex gap-1">
          {isCompleted && (
            <>
              <Button
                variant="secondary"
                size="icon-xs"
                className=" bg-black/40 backdrop-blur-[2px]"
                onClick={() => setOpen(true)}
                title="查看详情"
              >
                <Eye className="size-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon-xs"
                className=" bg-black/40 backdrop-blur-[2px]"
                onClick={downloadAudio}
                disabled={!item.audioBlob}
                title="下载"
              >
                <Download className="size-3.5" />
              </Button>
            </>
          )}
          {item.status !== StatusEnum.PROCESSING && (
            <Button
              variant="secondary"
              size="icon-xs"
              className=" bg-black/40 backdrop-blur-[2px]"
              onClick={() => removeHistory(item.id)}
              title="删除"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 w-full flex items-center justify-center p-2 text-xs border-t dark:bg-background/60 bg-white/60">
          <p className="truncate">{displayName}</p>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{displayName}</DialogTitle>
            <DialogDescription className="sr-only">
              请根据需要选择操作。
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-4 pr-3">
              <div className="w-full p-2 border rounded">
                {item.audioBlob ? (
                  <WaveformPlayer blob={item.audioBlob} />
                ) : (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <span>讲述者:</span>
                    <span className="ml-2">{item.speaker}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span>时间:</span>
                    <span className="ml-2">{item.timestamp}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">文本:</div>
                    <CopyButton size="icon" value={item.text} />
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-line">
                    {item.text}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAudio}
              disabled={!item.audioBlob}
            >
              <Download className="size-4" />
              下载音频
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function HistorySection() {
  const { history, clearHistory } = useHistoryStore()
  const [downloading, setDownloading] = useState(false)

  const completedItems = useMemo(
    () =>
      history.filter(
        (item) => item.status === StatusEnum.COMPLETED && item.audioBlob,
      ),
    [history],
  )

  const handleClearHistory = () => {
    clearHistory()
    toast.success('历史记录已清除！')
  }

  const handleDownloadAll = useCallback(async () => {
    if (completedItems.length === 0) return

    if (completedItems.length === 1) {
      const item = completedItems[0]
      const name = item.name ?? `${item.id}_audio`
      const filename = name.endsWith('.mp3') ? name : `${name}.mp3`
      downloadFile({ data: item.audioBlob!, filename })
      toast.success('音频下载成功！')
      return
    }

    setDownloading(true)
    try {
      const files: ZipFileEntry[] = completedItems.map((item) => {
        const name = item.name ?? `${item.id}_audio`
        const path = name.endsWith('.mp3') ? name : `${name}.mp3`
        return { path, data: item.audioBlob! }
      })
      await downloadFilesAsZip(files, 'bytts')
      toast.success('全部音频下载成功！')
    } catch {
      toast.error('下载失败，请重试')
    } finally {
      setDownloading(false)
    }
  }, [completedItems])

  return (
    <Card className="flex min-h-0 h-full flex-col gap-4 p-4">
      <CardHeader className="p-0 flex flex-row items-center justify-between gap-2">
        <CardTitle className="min-w-0 truncate">历史记录</CardTitle>
        <CardAction className="flex shrink-0 items-center gap-2">
          {completedItems.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={downloading}
              onClick={handleDownloadAll}
            >
              {downloading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              下载全部
            </Button>
          )}
          {history.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button size="sm" variant="secondary" />}
              >
                <Trash2 />
                清除历史
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认清除历史记录</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作将永久删除所有历史记录，包括文本和音频文件。此操作无法撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearHistory}>
                    确认清除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0 overflow-hidden">
        {history.length > 0 ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] p-0.5 pr-2.5">
              {history.map((item) => (
                <HistoryCard key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <IKEmpty
            icon={History}
            iconClassName="size-5"
            title="暂无历史记录"
            description="生成语音后，历史记录将显示在此处"
          />
        )}
      </CardContent>
    </Card>
  )
}
