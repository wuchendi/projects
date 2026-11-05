'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Label } from '@cdlab/ui/components/label'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { ModelType } from '@/types'

interface ImageUploadProps {
  modelType: ModelType
  supportsReference: boolean
  referenceImages: string[]
  setReferenceImages: (images: string[]) => void
  sourceImage: string
  setSourceImage: (image: string) => void
  maskImage: string
  setMaskImage: (image: string) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_DIMENSION = 512 // SD v1.5 native resolution; FLUX.2 reference limit
const MAX_REFERENCE_IMAGES = 4

function resizeAndConvertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      let { width, height } = img

      // Scale down to fit within MAX_DIMENSION while keeping aspect ratio
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      resolve(base64)

      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(file)
  })
}

function DropZone({
  label,
  preview,
  onFileSelect,
  onClear,
}: {
  label: string
  preview: string
  onFileSelect: (base64: string) => void
  onClear: () => void
}) {
  const t = useTranslations('upload')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error(t('invalidFile'))
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('fileTooLarge'))
        return
      }
      const base64 = await resizeAndConvertToBase64(file)
      onFileSelect(base64)
    },
    [onFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) void handleFile(file)
    },
    [handleFile],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFile(file)
      if (inputRef.current) inputRef.current.value = ''
    },
    [handleFile],
  )

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview ? (
        <div className="relative group rounded-lg overflow-hidden border">
          <img
            src={`data:image/png;base64,${preview}`}
            alt={label}
            className="w-full h-40 object-contain bg-muted"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onClear}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          role="button"
          tabIndex={0}
        >
          <ImagePlus className="size-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{t('dropHint')}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  )
}

export function ImageUpload({
  modelType,
  supportsReference,
  referenceImages,
  setReferenceImages,
  sourceImage,
  setSourceImage,
  maskImage,
  setMaskImage,
}: ImageUploadProps) {
  const t = useTranslations('upload')

  if (supportsReference) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('referenceTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('referenceHint', { max: MAX_REFERENCE_IMAGES })}
          </p>
          {referenceImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {referenceImages.map((image, i) => (
                <div
                  key={i}
                  className="relative group rounded-lg overflow-hidden border"
                >
                  <img
                    src={`data:image/png;base64,${image}`}
                    alt={`image ${i}`}
                    className="w-full aspect-square object-cover bg-muted"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    image {i}
                  </span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() =>
                      setReferenceImages(
                        referenceImages.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {referenceImages.length < MAX_REFERENCE_IMAGES && (
            <DropZone
              label={t('referenceAdd', {
                count: referenceImages.length,
                max: MAX_REFERENCE_IMAGES,
              })}
              preview=""
              onFileSelect={(image) =>
                setReferenceImages([...referenceImages, image])
              }
              onClear={() => {}}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  if (modelType === 'text2img') return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {modelType === 'img2img' ? t('img2imgTitle') : t('inpaintingTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DropZone
          label={t('sourceImage')}
          preview={sourceImage}
          onFileSelect={setSourceImage}
          onClear={() => setSourceImage('')}
        />

        {modelType === 'inpainting' && (
          <DropZone
            label={t('maskImage')}
            preview={maskImage}
            onFileSelect={setMaskImage}
            onClear={() => setMaskImage('')}
          />
        )}
      </CardContent>
    </Card>
  )
}
