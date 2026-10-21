'use client'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cdlab/ui/components/tabs'
import { IKPageContainer } from '@cdlab/ui/IK'
import { ListPlus, Video } from 'lucide-react'
import Script from 'next/script'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
  BatchInputCard,
  BatchQueueCard,
  SettingsDialog,
  SourceCard,
  TaskListCard,
} from '@/components/downloader'
import { useBatchActions } from '@/hooks/use-batch-actions'
import { useDownloadActions } from '@/hooks/use-download-actions'
import { useDownloadStore } from '@/stores/download-store'

export default function VideoDownloaderPage() {
  const t = useTranslations()
  const actions = useDownloadActions()
  const batch = useBatchActions()

  const isStreamSupported = useDownloadStore((s) => s.isStreamSupported)

  // Fallback: if StreamSaver.js loaded before the Script onLoad could fire
  useEffect(() => {
    if (!isStreamSupported && (window as any).streamSaver) {
      actions.onStreamSaverReady()
    }
  }, [isStreamSupported, actions])

  const [activeTab, setActiveTab] = useState('single')

  const cardAction = (
    <div className="flex items-center gap-2">
      <TabsList>
        <TabsTrigger value="single" disabled={batch.isBatchRunning}>
          <Video className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="batch" disabled={batch.isBatchRunning}>
          <ListPlus className="size-4" />
        </TabsTrigger>
      </TabsList>
      <SettingsDialog />
    </div>
  )

  return (
    <IKPageContainer scrollable={false}>
      <Script
        src="/static/StreamSaver.js"
        strategy="afterInteractive"
        onLoad={actions.onStreamSaverReady}
      />
      <div className="w-full h-full flex flex-col gap-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col gap-3 flex-1 min-h-0"
        >
          {/* Single */}
          <TabsContent value="single" className="space-y-4">
            <SourceCard headerAction={cardAction} actions={actions} />
          </TabsContent>

          {/* Batch */}
          <TabsContent value="batch" className="space-y-4">
            <BatchInputCard
              headerAction={cardAction}
              batchText={batch.batchText}
              onBatchTextChange={batch.setBatchText}
              disabled={batch.isBatchRunning || batch.isBatchParsing}
              onAddToQueue={batch.addToQueue}
            />
            {batch.batchList.length > 0 && <BatchQueueCard batch={batch} />}
          </TabsContent>
        </Tabs>

        <TaskListCard />
      </div>
    </IKPageContainer>
  )
}
