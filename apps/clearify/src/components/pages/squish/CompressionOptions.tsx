'use client'

import { Card } from '@cdlab/ui/components/card'
import { Field } from '@cdlab/ui/components/field'
import { Label } from '@cdlab/ui/components/label'
import { Slider } from '@cdlab/ui/components/slider'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import type {
  CompressionOptions as CompressionOptionsType,
  OutputType,
} from '@/types'

interface CompressionOptionsProps {
  outputType: OutputType
  options: CompressionOptionsType
  onOutputTypeChange: (type: OutputType) => void
  onQualityChange: (value: number) => void
}

export const CompressionOptions = ({
  outputType,
  options,
  onOutputTypeChange,
  onQualityChange,
}: CompressionOptionsProps) => (
  <Card className="p-4 rounded-md">
    <Field>
      <Label>Output Format</Label>
      <ToggleGroup
        variant="outline"
        value={[outputType]}
        onValueChange={(value) => {
          if (value[0]) onOutputTypeChange(value[0] as OutputType)
        }}
        className="grid grid-cols-5"
      >
        {(['avif', 'jpeg', 'jxl', 'png', 'webp'] as const).map((format) => (
          <ToggleGroupItem
            key={format}
            value={format}
            aria-label={`Select ${format} format`}
            className="uppercase text-xs font-bold w-full"
          >
            {format}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
    {outputType !== 'png' && (
      <Field>
        <Label htmlFor="imageQualityRangeInput">
          Quality: {options.quality}%
        </Label>
        <Slider
          id="imageQualityRangeInput"
          value={[options.quality]}
          min={1}
          max={100}
          step={1}
          onValueChange={(value) =>
            onQualityChange(Array.isArray(value) ? value[0] : value)
          }
          className="w-full focus:outline-none"
        />
      </Field>
    )}
  </Card>
)
