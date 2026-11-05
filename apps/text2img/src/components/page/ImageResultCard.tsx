import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import { Separator } from '@cdlab/ui/components/separator'
import { IKAssetFailed, IKAssetLoading } from '@cdlab/ui/IK'
import { downloadFile } from '@cdlab/utils'
import { format } from 'date-fns'
import { Copy, Download, Eye, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import type { GenerateParams, GenerationResult, Model } from '@/types'
import { GenerationStatus } from '@/types'

interface ImageResultCardProps {
  result: GenerationResult
  models?: Model[]
  onRemove: (id: string) => void
}

export function ImageResultCard({
  result,
  models,
  onRemove,
}: ImageResultCardProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const modelName = models?.find((m) => m.id === result.params.model)?.name
  const isCompleted = result.status === GenerationStatus.COMPLETED

  const copyParams = (params: GenerateParams) => {
    const paramNames: Record<string, string> = {
      prompt: t('params.prompt'),
      negative_prompt: t('params.negative_prompt'),
      model: t('params.model'),
      width: t('params.width'),
      height: t('params.height'),
      num_steps: t('params.num_steps'),
      guidance: t('params.guidance'),
      seed: t('params.seed'),
    }

    let paramsText = `${t('params.copyHeader')}\n`
    Object.entries(params).forEach(([key, value]) => {
      if (
        key === 'password' ||
        key === 'image_b64' ||
        key === 'mask_b64' ||
        key === 'reference_images_b64' ||
        !value
      )
        return
      const name = paramNames[key] || key
      paramsText += `${name}: ${value}\n`
    })

    navigator.clipboard.writeText(paramsText).then(
      () => toast.success(t('card.copiedToClipboard')),
      () => toast.error(t('card.copyFailed')),
    )
  }

  const downloadImage = () => {
    if (!result.imageUrl) return

    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    const name =
      models?.find((m) => m.id === result.params.model)?.name || 'ai-image'
    downloadFile({
      data: result.imageUrl,
      filename: `${name}-${timestamp}.png`,
    })
    toast.success(t('card.downloadSuccess'))
  }

  const paramLabels: Record<string, string> = {
    prompt: t('params.prompt'),
    negative_prompt: t('params.negative_prompt'),
    model: t('params.model'),
    width: t('params.width'),
    height: t('params.height'),
    num_steps: t('params.num_steps'),
    guidance: t('params.guidance'),
    seed: t('params.seed'),
  }

  return (
    <>
      <div className="group relative rounded-lg overflow-hidden bg-muted">
        <div className="aspect-square relative flex items-center justify-center">
          {result.status === GenerationStatus.PENDING && <IKAssetLoading />}

          {result.status === GenerationStatus.FAILED && (
            <IKAssetFailed error={result.error} />
          )}

          {isCompleted && result.imageUrl && (
            <img
              src={result.imageUrl}
              alt="Generated"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isCompleted && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="size-7"
                onClick={() => setOpen(true)}
                title={t('card.viewDetail')}
              >
                <Eye className="size-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="size-7"
                onClick={() => copyParams(result.params)}
                title={t('card.copyParams')}
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="size-7"
                onClick={downloadImage}
                title={t('card.downloadImage')}
              >
                <Download className="size-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="icon"
            className="size-7"
            onClick={() => onRemove(result.id)}
            title={t('card.delete')}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('card.imageDetail')}</DialogTitle>
            {modelName && (
              <DialogDescription>
                {t('card.modelLabel', { modelName })}
              </DialogDescription>
            )}
          </DialogHeader>

          {isCompleted && result.imageUrl && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
              <Image
                src={result.imageUrl}
                alt="Generated"
                fill
                className="object-contain"
              />
            </div>
          )}

          {result.status === GenerationStatus.FAILED && (
            <IKAssetFailed error={result.error} />
          )}

          {isCompleted && (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {result.generationTime && (
                  <div>
                    <span className="font-medium">
                      {t('card.generationTime')}
                    </span>
                    {result.generationTime.toFixed(2)}s
                  </div>
                )}
                {result.params.width && (
                  <div>
                    <span className="font-medium">{t('card.size')}</span>
                    {result.params.width}x{result.params.height}
                  </div>
                )}
                {result.params.num_steps && (
                  <div>
                    <span className="font-medium">{t('card.steps')}</span>
                    {result.params.num_steps}
                  </div>
                )}
                {result.params.guidance && (
                  <div>
                    <span className="font-medium">
                      {t('card.guidanceLabel')}
                    </span>
                    {result.params.guidance}
                  </div>
                )}
                {result.params.seed && (
                  <div>
                    <span className="font-medium">{t('card.seedLabel')}</span>
                    {result.params.seed}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('card.allParams')}</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.params).map(([key, value]) => {
                    if (
                      key === 'password' ||
                      key === 'image_b64' ||
                      key === 'mask_b64' ||
                      !value
                    )
                      return null
                    return (
                      <Badge key={key} variant="secondary">
                        <span className="font-medium">
                          {paramLabels[key] || key}:
                        </span>{' '}
                        {String(value).substring(0, 50)}
                        {String(value).length > 50 ? '...' : ''}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            {isCompleted && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyParams(result.params)}
                >
                  <Copy className="size-4" />
                  {t('card.copyParamsButton')}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadImage}>
                  <Download className="size-4" />
                  {t('card.downloadImageButton')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
