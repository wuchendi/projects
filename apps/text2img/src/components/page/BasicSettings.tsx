import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import type { CascaderOption } from '@cdlab/ui/components/cascader'
import { Cascader } from '@cdlab/ui/components/cascader'
import { Label } from '@cdlab/ui/components/label'
import { PasswordInput } from '@cdlab/ui/components/password-input'
import { Textarea } from '@cdlab/ui/components/textarea'
import { cn } from '@cdlab/ui/lib/utils'
import { Dices } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { ModelGroup } from '@/types'

interface BasicSettingsProps {
  modelGroups: ModelGroup[] | undefined
  password: string
  setPassword: (password: string) => void
  prompt: string
  setPrompt: (prompt: string) => void
  negativePrompt: string
  setNegativePrompt: (negativePrompt: string) => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  handleRandomPrompt: () => void
}

export function BasicSettings({
  modelGroups,
  password,
  setPassword,
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  selectedModel,
  setSelectedModel,
  handleRandomPrompt,
}: BasicSettingsProps) {
  const t = useTranslations()

  const selectedGroup = modelGroups?.find((group) =>
    group.models.some((m) => m.id === selectedModel),
  )

  const modelOptions: CascaderOption[] = (modelGroups ?? []).map((group) => ({
    value: group.id,
    textLabel: group.name,
    label: (
      <span className="flex items-center gap-2">
        {group.image && (
          <span className="relative inline-block w-4 h-4 shrink-0">
            <Image
              src={group.image}
              alt={group.name}
              fill
              sizes="16px"
              className={cn(
                'object-contain',
                group.monochrome && 'dark:invert',
              )}
            />
          </span>
        )}
        {group.name}
      </span>
    ),
    children: group.models.map((model) => ({
      value: model.id,
      textLabel: model.name,
      disabled: model.disabled,
      label: (
        <span className="flex max-w-64 flex-col whitespace-normal">
          <span className="font-medium flex items-center gap-1.5">
            {model.name}
            {model.type !== 'text2img' && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 font-normal"
              >
                {t(`modelType.${model.type}`)}
              </Badge>
            )}
            {model.highCost && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 font-normal border-amber-500/50 text-amber-600 dark:text-amber-400"
              >
                {t('basic.highCost')}
              </Badge>
            )}
          </span>
          {model.description && (
            <span className="text-xs text-muted-foreground mt-0.5">
              {/* next-intl treats "." as a key path separator */}
              {t(`models.${model.id.replaceAll('.', '_')}`)}
            </span>
          )}
        </span>
      ),
    })),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('basic.title')}</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleRandomPrompt}>
            <Dices className="size-4" />
            {t('basic.randomPrompt')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t('basic.password')}</Label>
          <PasswordInput
            id="password"
            placeholder={t('basic.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            toggleAriaLabel={t('basic.passwordToggle')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">{t('basic.prompt')}</Label>
          <Textarea
            id="prompt"
            rows={3}
            placeholder={t('basic.promptPlaceholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="negative_prompt">{t('basic.negativePrompt')}</Label>
          <Textarea
            id="negative_prompt"
            rows={2}
            placeholder={t('basic.negativePromptPlaceholder')}
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('basic.model')}</Label>
          <Cascader
            className="w-full"
            allowClear={false}
            placeholder={t('basic.selectModel')}
            value={selectedGroup ? [selectedGroup.id, selectedModel] : []}
            options={modelOptions}
            onChange={([, modelId]) => {
              if (modelId) setSelectedModel(modelId)
            }}
            displayRender={(labels) => labels.at(-1)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
