'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { toast } from 'sonner'
import { configApi, migrateApi } from '@/lib/platform/api'

export function MigrateView() {
  const t = useTranslations('migrate')
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportLinks = useMutation({
    mutationFn: () => migrateApi.exportLinks(),
    onError: (e: Error) => toast.error(e.message),
  })
  const exportCsv = useMutation({
    mutationFn: () => migrateApi.exportCsv(),
    onError: (e: Error) => toast.error(e.message),
  })
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const backup = useMutation({
    mutationFn: () => migrateApi.backup(),
    onSuccess: (r) => toast.success(t('backup.success', { key: r.key })),
    onError: (e: Error) => toast.error(e.message),
  })
  const importLinks = useMutation({
    mutationFn: (data: unknown) => migrateApi.importLinks(data),
    onSuccess: (report) => {
      toast.success(
        t('import.result', {
          success: report.success,
          skipped: report.skipped,
          failed: report.failed,
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['links'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      importLinks.mutate(data)
    } catch {
      toast.error(t('import.invalid'))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="ring-1">
          <CardHeader>
            <CardTitle className="text-base">{t('export.title')}</CardTitle>
            <CardDescription>{t('export.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => exportLinks.mutate()}
              disabled={exportLinks.isPending}
            >
              <Download className="mr-2 size-4" />
              {t('export.action')}
            </Button>
          </CardContent>
        </Card>

        <Card className="ring-1">
          <CardHeader>
            <CardTitle className="text-base">{t('import.title')}</CardTitle>
            <CardDescription>{t('import.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFile}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importLinks.isPending}
            >
              <Upload className="mr-2 size-4" />
              {importLinks.isPending ? t('import.running') : t('import.action')}
            </Button>
          </CardContent>
        </Card>

        <Card className="ring-1">
          <CardHeader>
            <CardTitle className="text-base">{t('csv.title')}</CardTitle>
            <CardDescription>{t('csv.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => exportCsv.mutate()}
              disabled={exportCsv.isPending}
            >
              <FileSpreadsheet className="mr-2 size-4" />
              {t('csv.action')}
            </Button>
          </CardContent>
        </Card>

        <Card className="ring-1">
          <CardHeader>
            <CardTitle className="text-base">{t('backup.title')}</CardTitle>
            <CardDescription>
              {config?.r2 ? t('backup.description') : t('backup.disabled')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => backup.mutate()}
              disabled={!config?.r2 || backup.isPending}
            >
              <Archive className="mr-2 size-4" />
              {backup.isPending ? t('backup.running') : t('backup.action')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
