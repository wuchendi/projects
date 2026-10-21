'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  applyURL,
  estimateFileSize,
  fetchData,
  fetchUrlMetadata,
  isDirectVideoUrl,
} from '@/lib'
import type { EngineNotifier } from '@/lib/download-engine'
import { DownloadEngine } from '@/lib/download-engine'
import type { BatchItem } from '@/stores/batch-store'
import { useBatchStore } from '@/stores/batch-store'
import { useDownloadStore } from '@/stores/download-store'
import { useSettingsStore } from '@/stores/settings-store'

// Re-export types for consumers
export type { BatchFormat, BatchItem, BatchStatus } from '@/stores/batch-store'

export function useBatchActions() {
  const t = useTranslations()
  const batchAbortRef = useRef(false)

  // Create a separate engine for batch mode
  const engineRef = useRef<DownloadEngine | null>(null)
  if (!engineRef.current) {
    const notify: EngineNotifier = {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }
    engineRef.current = new DownloadEngine(
      useDownloadStore,
      () => useSettingsStore.getState(),
      notify,
      // Batch items are not resumable yet; stage them but keep no task record.
      { persist: false },
    )
  }

  // Read store values for rendering
  const batchText = useBatchStore((s) => s.batchText)
  const setBatchText = useBatchStore((s) => s.setBatchText)
  const batchList = useBatchStore((s) => s.batchList)
  const isBatchParsing = useBatchStore((s) => s.isBatchParsing)
  const isBatchRunning = useBatchStore((s) => s.isBatchRunning)

  const {
    addItems,
    updateItem,
    removeItem,
    clearDone,
    setIsBatchParsing,
    setIsBatchRunning,
  } = useBatchStore.getState()

  // ---- Parse ----
  const parseItems = useCallback(
    async (items: BatchItem[]) => {
      if (items.length === 0) return
      setIsBatchParsing(true)
      for (const item of items) {
        updateItem(item.id, { status: 'parsing' })
        try {
          const meta = await fetchUrlMetadata(item.url)
          updateItem(item.id, {
            status: 'parsed',
            meta,
            selectedVariantUrl: meta.variants[0]?.url || '',
            rangeStart: 1,
            rangeEnd: meta.segmentCount || 0,
          })
        } catch {
          updateItem(item.id, { status: 'error' })
        }
      }
      setIsBatchParsing(false)
      toast.success(t('batch.parseComplete'))
    },
    [updateItem, setIsBatchParsing, t],
  )

  const addToQueue = useCallback(() => {
    const urls = useBatchStore
      .getState()
      .batchText.split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
    if (urls.length === 0) {
      toast.error(t('batch.emptyList'))
      return
    }

    const valid: string[] = []
    const invalid: string[] = []
    for (const url of urls) {
      try {
        new URL(url)
        if (isDirectVideoUrl(url) || url.toLowerCase().includes('m3u8')) {
          valid.push(url)
        } else {
          invalid.push(url)
        }
      } catch {
        invalid.push(url)
      }
    }

    if (invalid.length > 0) {
      toast.error(t('batch.invalidUrls', { count: invalid.length }))
    }
    if (valid.length === 0) return

    const items = addItems(valid)
    void parseItems(items)
  }, [t, addItems, parseItems])

  const parseAll = useCallback(() => {
    const toParse = useBatchStore
      .getState()
      .batchList.filter((b) => b.status === 'pending' || b.status === 'error')
    void parseItems(toParse)
  }, [parseItems])

  const onVariantChange = useCallback(
    async (item: BatchItem, variantUrl: string) => {
      updateItem(item.id, { selectedVariantUrl: variantUrl })
      try {
        const m3u8Str: string = await fetchData(variantUrl)
        const segUrls = m3u8Str
          .split('\n')
          .filter((l: string) => /^[^#]/.test(l) && l.trim())
          .map((l: string) => applyURL(l.trim(), variantUrl))
        updateItem(item.id, { rangeStart: 1, rangeEnd: segUrls.length })
        const size = await estimateFileSize(segUrls, 1, segUrls.length)
        if (size != null && item.meta) {
          updateItem(item.id, {
            meta: {
              ...item.meta,
              estimatedSize: size,
              segmentCount: segUrls.length,
            },
          })
        }
      } catch {
        /* keep existing */
      }
    },
    [updateItem],
  )

  // ---- Download ----
  const startBatchDownload = useCallback(async () => {
    const ready = useBatchStore
      .getState()
      .batchList.filter((b) => b.status === 'parsed')
    if (ready.length === 0) return
    setIsBatchRunning(true)
    batchAbortRef.current = false

    const engine = engineRef.current!
    const ds = useDownloadStore.getState()

    for (const item of ready) {
      if (batchAbortRef.current) break

      const downloadUrl =
        item.selectedVariantUrl || item.meta?.resolvedUrl || item.url
      updateItem(item.id, { status: 'downloading' })

      // Set up store state for this item
      ds.setUrl(downloadUrl)
      ds.setCustomFileName(item.customName.trim())

      // Reset engine state for new download
      engine.resetState()
      // Restore the URL after reset
      ds.setUrl(downloadUrl)
      ds.setCustomFileName(item.customName.trim())

      // Parse
      try {
        await engine.parseM3U8(downloadUrl)
      } catch {
        updateItem(item.id, { status: 'error' })
        continue
      }
      if (batchAbortRef.current) break

      // Apply custom range AFTER parse
      if (item.rangeEnd > 0) {
        ds.setRangeDownload({
          startSegment: String(item.rangeStart),
          endSegment: String(item.rangeEnd),
        })
      }

      const isStream = item.format.startsWith('stream-')
      const isGetMP4 = item.format === 'mp4' || item.format === 'stream-mp4'

      try {
        if (item.meta?.isDirectVideo) {
          await engine.directDownload()
        } else if (isStream) {
          await engine.streamDownload(isGetMP4)
        } else {
          await engine.startDownload(isGetMP4)
        }
        updateItem(item.id, { status: 'done' })
      } catch {
        updateItem(item.id, { status: 'error' })
      }

      await new Promise((r) => setTimeout(r, 300))
    }

    setIsBatchRunning(false)
    if (!batchAbortRef.current) toast.success(t('batch.complete'))
  }, [updateItem, setIsBatchRunning, t])

  const cancelBatch = useCallback(() => {
    batchAbortRef.current = true
    engineRef.current?.cancelDownload()
    setIsBatchRunning(false)
  }, [setIsBatchRunning])

  // ---- Derived ----
  const pendingCount = useBatchStore(
    (s) => s.batchList.filter((b) => b.status === 'pending').length,
  )
  const parsedCount = useBatchStore(
    (s) => s.batchList.filter((b) => b.status === 'parsed').length,
  )
  const doneCount = useBatchStore(
    (s) => s.batchList.filter((b) => b.status === 'done').length,
  )
  const errorCount = useBatchStore(
    (s) => s.batchList.filter((b) => b.status === 'error').length,
  )
  const currentDownloadingId = useBatchStore(
    (s) => s.batchList.find((b) => b.status === 'downloading')?.id ?? null,
  )

  return {
    batchText,
    setBatchText,
    batchList,
    isBatchParsing,
    isBatchRunning,
    pendingCount,
    parsedCount,
    doneCount,
    errorCount,
    currentDownloadingId,
    updateItem,
    addToQueue,
    removeBatchItem: removeItem,
    clearDone,
    parseAll,
    onVariantChange,
    startBatchDownload,
    cancelBatch,
  }
}
