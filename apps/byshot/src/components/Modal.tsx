'use client'

import { Dialog, DialogContent, DialogTitle } from '@cdlab/ui/components/dialog'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import useKeypress from 'react-use-keypress'
import type { ImageProps } from '@/utils/types'
import SharedModal from './SharedModal'

export default function Modal({
  images,
  photoAssetId,
  onClose,
}: {
  images: ImageProps[]
  photoAssetId: string
  onClose?: () => void
}) {
  const router = useRouter()
  const initialIndex = Math.max(
    0,
    images.findIndex((img) => img.asset_id === photoAssetId),
  )
  const [direction, setDirection] = useState(0)
  const [curIndex, setCurIndex] = useState(initialIndex)

  function handleClose() {
    router.push('/', { scroll: false })
    onClose?.()
  }

  function changePhotoId(newVal: number) {
    setDirection(newVal > curIndex ? 1 : -1)
    setCurIndex(newVal)
    const nextAssetId = images[newVal]?.asset_id
    if (nextAssetId) {
      window.history.replaceState(null, '', `/?photoId=${nextAssetId}`)
    }
  }

  useKeypress('ArrowRight', () => {
    if (curIndex + 1 < images.length) {
      changePhotoId(curIndex + 1)
    }
  })

  useKeypress('ArrowLeft', () => {
    if (curIndex > 0) {
      changePhotoId(curIndex - 1)
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={false}
        className="inset-0 top-0 left-0 flex max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 rounded-none bg-black/70 p-0 ring-0 backdrop-blur-2xl sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        <SharedModal
          index={curIndex}
          direction={direction}
          images={images}
          changePhotoId={changePhotoId}
          closeModal={handleClose}
          navigation={true}
        />
      </DialogContent>
    </Dialog>
  )
}
