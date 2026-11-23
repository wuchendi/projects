'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@cdlab/ui/components/drawer'
import { Separator } from '@cdlab/ui/components/separator'
import { Spinner } from '@cdlab/ui/components/spinner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { retryLogFromUi } from '@/lib/push-client'

interface LogDetail {
  id: string
  batchId: string
  userId: string
  userName: string | null
  templateCode: string
  status: 'success' | 'failed'
  renderedTitle: string
  renderedDesc: string
  variableSnapshot: Record<string, unknown>
  errorMessage: string | null
  errorPayload: unknown
  sentAt: string
}

async function fetchLog(id: string): Promise<LogDetail> {
  const res = await fetch(`/api/logs/${id}`)
  if (!res.ok) throw new Error('Failed to load log')
  return res.json()
}

interface Props {
  logId: string | null
  onClose: () => void
}

export function LogDetailDrawer({ logId, onClose }: Props) {
  const qc = useQueryClient()
  const router = useRouter()
  const { data: log, isLoading } = useQuery({
    queryKey: ['log', logId],
    queryFn: () => fetchLog(logId as string),
    enabled: !!logId,
  })

  const retry = useMutation({
    mutationFn: (id: string) => retryLogFromUi(id),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['logs'] })
      const action = {
        label: '查看批次',
        onClick: () => router.push(`/dashboard/logs/batches/${result.batchId}`),
      }
      if (result.alreadyRunning) {
        toast.info('已有推送正在进行', { action })
      } else {
        toast.success('推送已开始，正在后台发送', { action })
      }
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Drawer
      swipeDirection="right"
      open={!!logId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            推送日志
            {log?.status === 'success' ? (
              <Badge>success</Badge>
            ) : log?.status === 'failed' ? (
              <Badge variant="destructive">failed</Badge>
            ) : null}
          </DrawerTitle>
          <DrawerDescription>
            {log ? (
              <span className="space-x-3 text-xs">
                <span>用户：{log.userName || log.userId}</span>
                <span>模板：{log.templateCode || '—'}</span>
                <span>
                  时间：{new Date(log.sentAt).toLocaleString('zh-CN')}
                </span>
              </span>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading || !log ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : (
            <div className="space-y-5">
              <Section title="标题">
                <p className="text-sm">{log.renderedTitle || '—'}</p>
              </Section>
              <Section title="正文">
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
                  {log.renderedDesc || '—'}
                </pre>
              </Section>
              {log.errorMessage ? (
                <Section title="错误信息">
                  <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    {log.errorMessage}
                  </pre>
                </Section>
              ) : null}
              {log.errorPayload ? (
                <Section title="错误负载">
                  <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                    {JSON.stringify(log.errorPayload, null, 2)}
                  </pre>
                </Section>
              ) : null}
              <Section title="变量快照">
                <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(log.variableSnapshot, null, 2)}
                </pre>
              </Section>
              <Separator />
              <div className="text-xs text-muted-foreground">
                批次：
                <Link
                  href={`/dashboard/logs/batches/${log.batchId}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {log.batchId}
                </Link>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row justify-end gap-2">
          {log?.status === 'failed' ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate(log.id)}
            >
              {retry.isPending ? '重发中...' : '失败重发'}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}
