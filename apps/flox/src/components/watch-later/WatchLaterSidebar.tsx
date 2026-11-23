'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@cdlab/ui/components/drawer'
import { IKConfirmDialog } from '@cdlab/ui/IK'
import { TrashIcon, XIcon } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useSidebarStore } from '@/lib/store/sidebar-store'
import { useWatchLater } from '@/lib/store/watch-later-store'
import { WatchLaterList } from './WatchLaterList'

export function WatchLaterSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPremium =
    pathname === '/premium' || searchParams.get('premium') === '1'

  const { watchLaterOpen, setWatchLaterOpen } = useSidebarStore()
  const { items, removeFromWatchLater, clearWatchLater } =
    useWatchLater(isPremium)

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    videoId?: string
    source?: string
    isClearAll?: boolean
  }>({ isOpen: false })

  const handleDeleteItem = (videoId: string | number, source: string) => {
    setDeleteConfirm({ isOpen: true, videoId: String(videoId), source })
  }

  const confirmDelete = () => {
    if (deleteConfirm.isClearAll) {
      clearWatchLater()
    } else if (deleteConfirm.videoId && deleteConfirm.source) {
      removeFromWatchLater(deleteConfirm.videoId, deleteConfirm.source)
    }
    setDeleteConfirm({ isOpen: false })
  }

  return (
    <>
      <Drawer
        open={watchLaterOpen}
        onOpenChange={setWatchLaterOpen}
        swipeDirection="right"
      >
        <DrawerContent className="flex flex-col">
          <DrawerHeader className="flex-row items-center justify-between border-b">
            <DrawerTitle>稍后观看</DrawerTitle>
            <DrawerClose render={<Button variant="ghost" size="icon-xs" />}>
              <XIcon className="size-4" />
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <WatchLaterList
              items={items}
              onRemove={handleDeleteItem}
              isPremium={isPremium}
            />
          </div>

          {items.length > 0 && (
            <DrawerFooter className="border-t">
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteConfirm({ isOpen: true, isClearAll: true })
                }
                className="w-full"
              >
                <TrashIcon className="size-4" />
                清空稍后观看
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>

      <IKConfirmDialog
        open={deleteConfirm.isOpen}
        title={deleteConfirm.isClearAll ? '清空稍后观看' : '移除视频'}
        description={
          deleteConfirm.isClearAll
            ? '确定要清空所有稍后观看吗？此操作无法撤销。'
            : '确定要从稍后观看中移除这个视频吗？'
        }
        onConfirm={confirmDelete}
        onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false })}
        confirmText="确定"
        cancelText="取消"
      />
    </>
  )
}
