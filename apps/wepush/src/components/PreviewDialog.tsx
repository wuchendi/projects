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
import { Spinner } from '@cdlab/ui/components/spinner'

export interface PreviewResult {
  templateCode: string
  title: string
  desc: string
  variables: Record<string, { value: string; color?: string }>
  sourceErrors: Record<string, string>
}

interface Props {
  open: boolean
  onClose: () => void
  loading: boolean
  result?: PreviewResult
  error?: string
}

export function PreviewDialog({
  open,
  onClose,
  loading,
  result,
  error,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>模板预览</DialogTitle>
          <DialogDescription>
            根据用户配置 + 所选模板渲染，不发送任何消息。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : error ? (
          <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </pre>
        ) : result ? (
          <ScrollArea className="-mr-3 min-w-0 *:data-[slot=scroll-area-viewport]:max-h-[60vh]">
            <div className="space-y-4 pr-3">
              <Section title="标题">
                <p className="text-sm wrap-break-word">{result.title || '—'}</p>
              </Section>
              <Section title="正文">
                <pre className="whitespace-pre-wrap wrap-break-word rounded-md border bg-muted/30 p-3 text-xs">
                  {result.desc || '—'}
                </pre>
              </Section>
              {Object.keys(result.sourceErrors).length > 0 ? (
                <Section title="数据源警告">
                  <pre className="whitespace-pre-wrap break-all rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                    {JSON.stringify(result.sourceErrors, null, 2)}
                  </pre>
                </Section>
              ) : null}
              <Section title="变量">
                <pre className="whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(result.variables, null, 2)}
                </pre>
              </Section>
            </div>
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
