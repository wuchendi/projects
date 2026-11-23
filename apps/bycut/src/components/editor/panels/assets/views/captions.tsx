import { Button } from '@cdlab/ui/components/button'
import { Label } from '@cdlab/ui/components/label'
import { Progress } from '@cdlab/ui/components/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Spinner } from '@cdlab/ui/components/spinner'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { PanelBaseView as BaseView } from '@/components/editor/panels/panel-base-view'
import {
  createSubtitleFromTemplate,
  SUBTITLE_TEMPLATES,
} from '@/constants/subtitle-constants'
import {
  DEFAULT_TRANSCRIPTION_MODEL,
  TRANSCRIPTION_LANGUAGES,
  TRANSCRIPTION_MODELS,
} from '@/constants/transcription-constants'
import { useLocalStorage } from '@/hooks/storage/use-local-storage'
import { useEditor } from '@/hooks/use-editor'
import { decodeAudioToFloat32 } from '@/lib/media/audio'
import { extractTimelineAudio } from '@/lib/media/mediabunny'
import { buildCaptionChunks } from '@/lib/transcription/caption'
import { transcriptionService } from '@/services/transcription/service'
import type {
  TranscriptionLanguage,
  TranscriptionModelId,
  TranscriptionProgress,
} from '@/types/transcription'

export function Captions() {
  const t = useTranslations()
  const [selectedLanguage, setSelectedLanguage] =
    useLocalStorage<TranscriptionLanguage>({
      key: 'editor-caption-language',
      defaultValue: 'auto',
    })
  const [selectedModelId, setSelectedModelId] =
    useLocalStorage<TranscriptionModelId>({
      key: 'editor-caption-model-id',
      defaultValue: DEFAULT_TRANSCRIPTION_MODEL,
    })
  const [selectedTemplateId, setSelectedTemplateId] = useLocalStorage<string>({
    key: 'editor-caption-template-id',
    defaultValue: SUBTITLE_TEMPLATES[0].templateId,
  })
  const selectedTemplate = useMemo(
    () =>
      SUBTITLE_TEMPLATES.find((t) => t.templateId === selectedTemplateId) ??
      SUBTITLE_TEMPLATES[0],
    [selectedTemplateId],
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('')
  const [progressValue, setProgressValue] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const editor = useEditor()

  const handleProgress = (progress: TranscriptionProgress) => {
    if (progress.status === 'loading-model') {
      setProgressValue(progress.progress)
      setProcessingStep(
        t('captions.loadingModel', {
          progress: Math.round(progress.progress),
        }),
      )
    } else if (progress.status === 'transcribing') {
      setProgressValue(progress.progress)
      setProcessingStep(
        t('captions.transcribing', {
          progress: Math.round(progress.progress),
        }),
      )
    }
  }

  const handleGenerateTranscript = async () => {
    try {
      setIsProcessing(true)
      setError(null)
      setProgressValue(0)
      setProcessingStep(t('captions.extractingAudio'))

      const audioBlob = await extractTimelineAudio({
        tracks: editor.timeline.getTracks(),
        mediaAssets: editor.media.getAssets(),
        totalDuration: editor.timeline.getTotalDuration(),
      })

      setProcessingStep(t('captions.preparingAudio'))
      const { samples } = await decodeAudioToFloat32({
        audioBlob,
        targetSampleRate: 16000,
      })

      const result = await transcriptionService.transcribe({
        audioData: samples,
        language: selectedLanguage,
        modelId: selectedModelId,
        onProgress: handleProgress,
      })

      setProcessingStep(t('captions.generating'))
      const captionChunks = buildCaptionChunks({ segments: result.segments })

      const captionTrackId = editor.timeline.addTrack({
        type: 'text',
        index: 0,
      })

      const baseCaptionElement = createSubtitleFromTemplate({
        template: selectedTemplate,
        startTime: 0,
      })

      for (let i = 0; i < captionChunks.length; i++) {
        const caption = captionChunks[i]
        editor.timeline.insertElement({
          placement: { mode: 'explicit', trackId: captionTrackId },
          element: {
            ...baseCaptionElement,
            name: `Caption ${i + 1}`,
            content: caption.text,
            duration: caption.duration,
            startTime: caption.startTime,
            trimStart: 0,
            trimEnd: 0,
          },
        })
      }
    } catch (error) {
      console.error('Transcription failed:', error)
      setError(
        error instanceof Error ? error.message : t('common.unexpectedError'),
      )
    } finally {
      setIsProcessing(false)
      setProcessingStep('')
      setProgressValue(0)
    }
  }

  const handleLanguageChange = ({ value }: { value: string }) => {
    if (value === 'auto') {
      setSelectedLanguage({ value: 'auto' })
      return
    }

    const matchedLanguage = TRANSCRIPTION_LANGUAGES.find(
      (language) => language.code === value,
    )
    if (!matchedLanguage) return
    setSelectedLanguage({ value: matchedLanguage.code })
  }

  const handleTemplateChange = ({ value }: { value: string }) => {
    const template = SUBTITLE_TEMPLATES.find((t) => t.templateId === value)
    if (template) {
      setSelectedTemplateId({ value: template.templateId })
    }
  }

  return (
    <BaseView
      ref={containerRef}
      className="flex h-full flex-col justify-between"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Label>{t('common.model')}</Label>
          <Select
            value={selectedModelId}
            items={TRANSCRIPTION_MODELS.map((model) => ({
              value: model.id,
              label: model.name,
            }))}
            onValueChange={(value) => {
              if (value === null) return
              setSelectedModelId({
                value: value as TranscriptionModelId,
              })
            }}
            disabled={isProcessing}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('ai.selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {TRANSCRIPTION_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {TRANSCRIPTION_MODELS.find((m) => m.id === selectedModelId)
              ?.description ?? ''}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Label>{t('common.language')}</Label>
          <Select
            value={selectedLanguage}
            items={[
              { value: 'auto', label: t('captions.autoDetect') },
              ...TRANSCRIPTION_LANGUAGES.map((language) => ({
                value: language.code,
                label: language.name,
              })),
            ]}
            onValueChange={(value) => {
              if (value !== null) handleLanguageChange({ value })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('captions.selectLanguage')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('captions.autoDetect')}</SelectItem>
              {TRANSCRIPTION_LANGUAGES.map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  {language.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3">
          <Label>{t('properties.subtitleStyle')}</Label>
          <Select
            value={selectedTemplate.templateId}
            items={SUBTITLE_TEMPLATES.map((template) => ({
              value: template.templateId,
              label: template.templateName,
            }))}
            onValueChange={(value) => {
              if (value !== null) handleTemplateChange({ value })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('ai.selectStyle')} />
            </SelectTrigger>
            <SelectContent>
              {SUBTITLE_TEMPLATES.map((template) => (
                <SelectItem
                  key={template.templateId}
                  value={template.templateId}
                >
                  {template.templateName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="flex items-center justify-center rounded-md border p-4"
            style={{ backgroundColor: '#1a1a2e', minHeight: 60 }}
          >
            <span
              style={{
                fontSize: 14,
                fontFamily: selectedTemplate.fontFamily,
                color: selectedTemplate.color,
                backgroundColor: selectedTemplate.backgroundColor,
                fontWeight: selectedTemplate.fontWeight,
                fontStyle: selectedTemplate.fontStyle,
                textDecoration: selectedTemplate.textDecoration,
                padding: '2px 6px',
                borderRadius: 2,
              }}
            >
              {t('misc.namePreview', {
                name: selectedTemplate.templateName,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {error && (
          <div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col gap-1.5">
            <Progress value={progressValue} className="w-full" />
            <p className="text-muted-foreground text-center text-xs">
              {processingStep}
            </p>
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleGenerateTranscript}
          disabled={isProcessing}
        >
          {isProcessing && <Spinner className="mr-1" />}
          {isProcessing
            ? t('common.processing')
            : t('captions.generateTranscript')}
        </Button>
      </div>
    </BaseView>
  )
}
