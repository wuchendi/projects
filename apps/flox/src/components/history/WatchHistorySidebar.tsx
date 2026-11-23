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
import { useHistory } from '@/lib/store/history-store'
import { useSidebarStore } from '@/lib/store/sidebar-store'
import { HistoryList } from './HistoryList'

export function WatchHistorySidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPremium =
    pathname === '/premium' || searchParams.get('premium') === '1'

  const { historyOpen, setHistoryOpen } = useSidebarStore()
  const { viewingHistory, removeFromHistory, clearHistory } =
    useHistory(isPremium)

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
      clearHistory()
    } else if (deleteConfirm.videoId && deleteConfirm.source) {
      removeFromHistory(deleteConfirm.videoId, deleteConfirm.source)
    }
    setDeleteConfirm({ isOpen: false })
  }

  return (
    <>
      <Drawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        swipeDirection="right"
      >
        <DrawerContent className="flex flex-col">
          <DrawerHeader className="flex-row items-center justify-between border-b">
            <DrawerTitle>观看历史</DrawerTitle>
            <DrawerClose render={<Button variant="ghost" size="icon-xs" />}>
              <XIcon className="size-4" />
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <HistoryList history={viewingHistory} onRemove={handleDeleteItem} />
          </div>

          {viewingHistory.length > 0 && (
            <DrawerFooter className="border-t">
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteConfirm({ isOpen: true, isClearAll: true })
                }
                className="w-full"
              >
                <TrashIcon className="size-4" />
                清空历史
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>

      <IKConfirmDialog
        open={deleteConfirm.isOpen}
        title={deleteConfirm.isClearAll ? '清空历史记录' : '删除历史记录'}
        description={
          deleteConfirm.isClearAll
            ? '确定要清空所有观看历史吗？此操作无法撤销。'
            : '确定要删除这条历史记录吗？'
        }
        onConfirm={confirmDelete}
        onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false })}
        confirmText="删除"
        cancelText="取消"
      />
    </>
  )
}
