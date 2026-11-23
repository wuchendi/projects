'use client'

import { Button } from '@cdlab/ui/components/button'
import { Checkbox } from '@cdlab/ui/components/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { PanelBaseView } from '@/components/editor/panels/panel-base-view'
import { DEFAULT_VOICE_PACK, VOICE_PACKS } from '@/constants/tts-constants'
import { useEditor } from '@/hooks/use-editor'
import { i18next } from '@/lib/i18n'
import { generateAndInsertSpeech } from '@/lib/tts/service'
import type { TextElement } from '@/types/timeline'
import {
  PropertyGroup,
  PropertyItem,
  PropertyItemLabel,
  PropertyItemValue,
} from './property-item'

interface TextElementRef {
  element: TextElement
  trackId: string
}

export function TextSpeechPanel({
  elements: elementRefs,
}: {
  elements: TextElementRef[]
}) {
  const t = useTranslations()
  const editor = useEditor()
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_PACK)
  const [alignDuration, setAlignDuration] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (elementRefs.length === 0) return

    setIsGenerating(true)
    const toastId = 'tts-generate'

    toast.loading(i18next.t('tts.generating'), { id: toastId })

    let successCount = 0
    let failCount = 0

    for (const { element, trackId: textTrackId } of elementRefs) {
      try {
        const { duration } = await generateAndInsertSpeech({
          editor,
          text: element.content,
          startTime: element.startTime,
          voice: selectedVoice,
        })

        if (alignDuration) {
          editor.timeline.updateElementDuration({
            trackId: textTrackId,
            elementId: element.id,
            duration,
          })
        }

        successCount++
      } catch (error) {
        console.error('TTS generation failed:', error)
        failCount++
      }
    }

    if (failCount === 0) {
      toast.success(i18next.t('tts.success'), { id: toastId })
    } else {
      toast.warning(
        i18next.t('tts.generateResult', {
          success: successCount,
          fail: failCount,
        }),
        { id: toastId },
      )
    }

    setIsGenerating(false)
  }

  return (
    <PanelBaseView className="p-0">
      <PropertyGroup
        title={t('assets.textToSpeech')}
        hasBorderTop={false}
        collapsible={false}
      >
        <div className="space-y-6">
          <PropertyItem direction="column">
            <PropertyItemLabel>{t('tts.voice')}</PropertyItemLabel>
            <PropertyItemValue>
              <Select
                value={selectedVoice}
                items={VOICE_PACKS.map((voice) => ({
                  value: voice.id,
                  label: voice.name,
                }))}
                onValueChange={(value) => {
                  if (value !== null) setSelectedVoice(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('tts.selectVoice')} />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_PACKS.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyItemValue>
          </PropertyItem>

          <div className="flex items-center gap-2">
            <Checkbox
              id="align-text-duration"
              checked={alignDuration}
              onCheckedChange={(checked) => setAlignDuration(checked === true)}
            />
            <label
              htmlFor="align-text-duration"
              className="cursor-pointer text-sm"
            >
              {t('properties.alignTextDuration')}
            </label>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={isGenerating || elementRefs.length === 0}
            onClick={handleGenerate}
          >
            {isGenerating ? t('common.generating') : t('ai.generateSpeech')}
          </Button>
        </div>
      </PropertyGroup>
    </PanelBaseView>
  )
}
