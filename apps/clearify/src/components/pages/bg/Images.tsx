'use client'

import { Button } from '@cdlab/ui/components/button'
import { ImageCompare } from '@cdlab/ui/components/image-compare'
import { IKEmpty } from '@cdlab/ui/IK'
import { cn } from '@cdlab/ui/lib/utils'
import { CloudUpload, Download, Edit2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  IKAssetFailed,
  IKAssetLoading,
  IKAssetStatusRenderer,
} from '@/components/IK'
import type { BgImageFile } from '@/types'
import { EditModal } from './EditModal'

interface ImagesProps {
  images: BgImageFile[]
  onDelete: (id: string) => void
}

export function Images({ images, onDelete }: ImagesProps) {
  if (images.length === 0) {
    return (
      <IKEmpty
        icon={CloudUpload}
        className="h-full min-h-[400px]"
        title="No images yet"
        description="Upload images to remove backgrounds"
      />
    )
  }

  return (
    <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-0.5">
      {images.map((image) => (
        <ImageItem key={image.id} image={image} onDelete={onDelete} />
      ))}
    </div>
  )
}

interface ImageItemProps {
  image: BgImageFile
  onDelete: (id: string) => void
}

function ImageItem({ image, onDelete }: ImageItemProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editedImageUrl, setEditedImageUrl] = useState('')

  const handleEditSave = (url: string) => {
    setEditedImageUrl(url)
  }

  const transparentBg =
    'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAGUExURb+/v////5nD/3QAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAUSURBVBjTYwABQSCglEENMxgYGAAynwRB8BEAgQAAAABJRU5ErkJggg==")'

  const renderLoading = useCallback(
    () => (
      <div className="relative flex items-center justify-center rounded-sm shadow-none shrink-0 aspect-square overflow-hidden">
        <IKAssetLoading />
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            variant="secondary"
            size="icon-xs"
            className="bg-black/40 backdrop-blur-[2px]"
            onClick={() => onDelete(image.id)}
            title="Remove"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    ),
    [image.id, onDelete],
  )

  const renderSuccess = useCallback(
    () => (
      <div className="relative flex items-center justify-center rounded-sm shadow-none shrink-0 aspect-square overflow-hidden">
        <div
          className="w-full h-full"
          style={{
            background: transparentBg,
            backgroundRepeat: 'repeat',
          }}
        >
          <ImageCompare
            leftImage={image.preview || ''}
            leftImageAlt="Original"
            rightImage={editedImageUrl || image.processedUrl || ''}
            rightImageAlt="Processed"
            fill
            objectFit="contain"
          />
        </div>
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            variant="secondary"
            size="icon-xs"
            className="bg-black/40 backdrop-blur-[2px]"
            onClick={() => setIsEditModalOpen(true)}
            title="Edit"
          >
            <Edit2 className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon-xs"
            className="bg-black/40 backdrop-blur-[2px]"
            title="Download"
            nativeButton={false}
            render={
              <a
                href={editedImageUrl || image.processedUrl || ''}
                download={`bg-removed-${image.id}.png`}
              />
            }
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon-xs"
            className="bg-black/40 backdrop-blur-[2px]"
            onClick={() => onDelete(image.id)}
            title="Remove"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    ),
    [image, editedImageUrl, onDelete],
  )

  const renderFailure = useCallback(
    () => (
      <div className="relative flex items-center justify-center rounded-sm shadow-none shrink-0 aspect-square overflow-hidden">
        <IKAssetFailed error={image.error} />
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            variant="secondary"
            size="icon-xs"
            className="bg-black/40 backdrop-blur-[2px]"
            onClick={() => onDelete(image.id)}
            title="Remove"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    ),
    [image.error, image.id, onDelete],
  )

  return (
    <>
      <div
        className={cn(
          'rounded-md bg-linear-to-r from-[#1a1b2e]/50 to-[#2a2b3e]/50 backdrop-blur-lg',
          'border border-border/30 shadow-lg p-3',
          'transition-shadow duration-200 hover:ring-2 hover:ring-primary',
        )}
      >
        <IKAssetStatusRenderer
          status={image.status}
          renderLoading={renderLoading}
          renderSuccess={renderSuccess}
          renderFailure={renderFailure}
        />
      </div>

      <EditModal
        image={image}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditSave}
      />
    </>
  )
}
