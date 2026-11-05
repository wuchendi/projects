'use client'

import { Button } from '@cdlab/ui/components/button'
import { IKPageContainer } from '@cdlab/ui/IK'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { AdvancedOptions } from '@/components/page/AdvancedOptions'
import { BasicSettings } from '@/components/page/BasicSettings'
import { ImageResult } from '@/components/page/ImageResult'
import { ImageUpload } from '@/components/page/ImageUpload'
import { fetchModels, fetchPrompts, genid } from '@/lib'
import { useGeneration } from '@/lib/hooks/useGeneration'
import type { GenerateParams, ModelGroup, ModelType } from '@/types'

export default function Home() {
  const t = useTranslations()
  const [prompt, setPrompt] = useState('cyberpunk cat')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('flux-1-schnell')
  const [password, setPassword] = useState('')

  // Image upload (img2img / inpainting)
  const [sourceImage, setSourceImage] = useState('')
  const [maskImage, setMaskImage] = useState('')
  // Reference images (FLUX.2)
  const [referenceImages, setReferenceImages] = useState<string[]>([])

  // Advanced options
  const [width, setWidth] = useState(1024)
  const [height, setHeight] = useState(1024)
  const [numSteps, setNumSteps] = useState(20)
  const [guidance, setGuidance] = useState(7.5)
  const [seed, setSeed] = useState<number | ''>('')

  const { data: modelGroups } = useQuery<ModelGroup[]>({
    queryKey: ['ModelGroups'],
    queryFn: fetchModels,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const { data: prompts } = useQuery<string[]>({
    queryKey: ['prompts'],
    queryFn: fetchPrompts,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const {
    mutation,
    results,
    handleGenerateClick,
    handleRemove,
    handleClearAll,
  } = useGeneration()

  const models = modelGroups
    ? modelGroups.flatMap((group) => group.models)
    : undefined

  const currentModel = models?.find((m) => m.id === selectedModel)
  const currentModelType: ModelType = currentModel?.type || 'text2img'
  const supportsReference = !!currentModel?.supportsReference

  const handleRandomPrompt = () => {
    if (prompts && prompts.length > 0) {
      const randomIndex = Math.floor(Math.random() * prompts.length)
      setPrompt(prompts[randomIndex])
    }
  }

  const handleRandomSeed = () => {
    setSeed(genid.nextNumber())
  }

  const onGenerateClick = () => {
    if (!password) {
      toast.error(t('basic.passwordRequired'))
      return
    }
    const params: GenerateParams = {
      prompt,
      model: selectedModel,
      password,
      negative_prompt: negativePrompt || undefined,
      width,
      height,
      num_steps: numSteps,
      guidance,
      seed: seed || undefined,
      image_b64:
        currentModelType !== 'text2img' && sourceImage
          ? sourceImage
          : undefined,
      mask_b64:
        currentModelType === 'inpainting' && maskImage ? maskImage : undefined,
      reference_images_b64:
        supportsReference && referenceImages.length > 0
          ? referenceImages
          : undefined,
    }
    handleGenerateClick(params)
  }

  return (
    <IKPageContainer scrollable={false}>
      <div className="w-full h-full grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <div className="space-y-4">
          <BasicSettings
            modelGroups={modelGroups}
            password={password}
            setPassword={setPassword}
            prompt={prompt}
            setPrompt={setPrompt}
            negativePrompt={negativePrompt}
            setNegativePrompt={setNegativePrompt}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            handleRandomPrompt={handleRandomPrompt}
          />

          <ImageUpload
            modelType={currentModelType}
            supportsReference={supportsReference}
            referenceImages={referenceImages}
            setReferenceImages={setReferenceImages}
            sourceImage={sourceImage}
            setSourceImage={setSourceImage}
            maskImage={maskImage}
            setMaskImage={setMaskImage}
          />

          <AdvancedOptions
            width={width}
            setWidth={setWidth}
            height={height}
            setHeight={setHeight}
            numSteps={numSteps}
            setNumSteps={setNumSteps}
            guidance={guidance}
            setGuidance={setGuidance}
            seed={seed}
            setSeed={setSeed}
            handleRandomSeed={handleRandomSeed}
          />

          <Button
            className="w-full"
            size="lg"
            onClick={onGenerateClick}
            disabled={mutation.isPending || !selectedModel}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('common.generating')}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {t('common.generateImage')}
              </>
            )}
          </Button>
        </div>

        <ImageResult
          results={results}
          models={models}
          onRemove={handleRemove}
          onClearAll={handleClearAll}
        />
      </div>
    </IKPageContainer>
  )
}
