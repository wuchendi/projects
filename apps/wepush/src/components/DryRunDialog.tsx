'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { DryRunUserResult } from '@/lib/push-client'

interface Props {
  open: boolean
  onClose: () => void
  loading: boolean
  results?: DryRunUserResult[]
  error?: string
}

export function DryRunDialog({
  open,
  onClose,
  loading,
  results,
  error,
}: Props) {
  const hasWarnings = results?.some(
    (r) => r.error || Object.keys(r.sourceErrors).length > 0,
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>推送预览（不发送）</DialogTitle>
          <DialogDescription>
            {loading
              ? '正在渲染模板变量，请稍候…'
              : results
                ? `${results.length} 位接收人${hasWarnings ? '，部分有警告' : '，全部正常'}`
                : '渲染模板变量以检查推送内容'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="-mr-3 min-w-0 *:data-[slot=scroll-area-viewport]:max-h-[60vh]">
          <div className="space-y-3 pr-3">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-3.5 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </pre>
            ) : results?.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                没有可预览的接收人（已启用的用户为空）
              </p>
            ) : (
              results?.map((r) => (
                <div
                  key={r.userId}
                  className="space-y-2 rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {r.error ? (
                        <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                      ) : (
                        <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                      )}
                      <span className="truncate text-sm font-medium">
                        {r.userName || r.userId}
                      </span>
                      {r.templateCode ? (
                        <span
                          className="truncate font-mono text-xs text-muted-foreground"
                          title={r.templateCode}
                        >
                          {r.templateCode}
                        </span>
                      ) : null}
                    </div>
                    {Object.keys(r.sourceErrors).length > 0 ? (
                      <span className="shrink-0 text-xs text-amber-500">
                        {Object.keys(r.sourceErrors).length} 个数据源警告
                      </span>
                    ) : null}
                  </div>
                  {r.error ? (
                    <p className="text-xs text-destructive">{r.error}</p>
                  ) : (
                    <>
                      {r.title ? (
                        <p className="border-b pb-1.5 text-xs font-medium wrap-break-word">
                          {r.title}
                        </p>
                      ) : null}
                      <pre className="whitespace-pre-wrap wrap-break-word rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        {r.desc || '—'}
                      </pre>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
