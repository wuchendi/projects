import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cdlab/ui/components/input-group'
import { Label } from '@cdlab/ui/components/label'
import { Slider } from '@cdlab/ui/components/slider'
import { Shuffle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AdvancedOptionsProps {
  width: number
  setWidth: (width: number) => void
  height: number
  setHeight: (height: number) => void
  numSteps: number
  setNumSteps: (numSteps: number) => void
  guidance: number
  setGuidance: (guidance: number) => void
  seed: number | ''
  setSeed: (seed: number | '') => void
  handleRandomSeed: () => void
}

export function AdvancedOptions({
  width,
  setWidth,
  height,
  setHeight,
  numSteps,
  setNumSteps,
  guidance,
  setGuidance,
  seed,
  setSeed,
  handleRandomSeed,
}: AdvancedOptionsProps) {
  const t = useTranslations('advanced')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="width">{t('width')}</Label>
            <span className="text-sm font-mono">{width}px</span>
          </div>
          <Slider
            id="width"
            min={256}
            max={2048}
            step={1}
            value={[width]}
            onValueChange={(v) => setWidth(Array.isArray(v) ? v[0] : v)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="height">{t('height')}</Label>
            <span className="text-sm font-mono">{height}px</span>
          </div>
          <Slider
            id="height"
            min={256}
            max={2048}
            step={1}
            value={[height]}
            onValueChange={(v) => setHeight(Array.isArray(v) ? v[0] : v)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="num_steps">{t('numSteps')}</Label>
            <span className="text-sm font-mono">{numSteps}</span>
          </div>
          <Slider
            id="num_steps"
            min={1}
            max={20}
            step={1}
            value={[numSteps]}
            onValueChange={(v) => setNumSteps(Array.isArray(v) ? v[0] : v)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="guidance">{t('guidance')}</Label>
            <span className="text-sm font-mono">{guidance.toFixed(1)}</span>
          </div>
          <Slider
            id="guidance"
            min={0}
            max={30}
            step={0.5}
            value={[guidance]}
            onValueChange={(v) => setGuidance(Array.isArray(v) ? v[0] : v)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seed">{t('seed')}</Label>
          <InputGroup>
            <InputGroupInput
              id="seed"
              type="number"
              placeholder={t('seedPlaceholder')}
              value={seed}
              onChange={(e) =>
                setSeed(e.target.value ? Number(e.target.value) : '')
              }
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={handleRandomSeed}>
                <Shuffle className="size-4" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <p className="text-xs text-muted-foreground">{t('seedHint')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
