import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Field, FieldGroup } from '@cdlab/ui/components/field'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import type { ConversionSettings } from '@/types'

const qualityItems = [
  { value: 'low', label: 'Low (Smallest Size)' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'very_high', label: 'Very High (Best Quality)' },
]

const videoBitrateItems = [
  { value: '300k', label: '300 Kbps' },
  { value: '1000k', label: '1 Mbps' },
  { value: '2500k', label: '2.5 Mbps' },
  { value: '5000k', label: '5 Mbps' },
  { value: '8000k', label: '8 Mbps' },
]

const compressionMethodItems = [
  { value: 'quality', label: 'Quality preset' },
  { value: 'filesize', label: 'Target file size (MB)' },
  { value: 'bitrate', label: 'Target bitrate' },
]

const videoCodecItems = [
  { value: 'avc', label: 'H.264' },
  { value: 'hevc', label: 'H.265' },
]

const audioBitrateItems = [
  { value: '64k', label: '64 kbps' },
  { value: '96k', label: '96 kbps' },
  { value: '128k', label: '128 kbps' },
  { value: '192k', label: '192 kbps' },
  { value: '256k', label: '256 kbps' },
]

const frameRateItems = [
  { value: 'original', label: 'Original' },
  { value: '24', label: '24 fps' },
  { value: '30', label: '30 fps' },
  { value: '60', label: '60 fps' },
]

const resolutionItems = [
  { value: 'original', label: 'Original' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
]

interface CompressionSettingsProps {
  settings: ConversionSettings
  onSettingChange: (key: keyof ConversionSettings, value: string) => void
}

export function CompressionSettings({
  settings,
  onSettingChange,
}: CompressionSettingsProps) {
  const renderCompressionControl = () => {
    switch (settings.compressionMethod) {
      case 'quality':
        return (
          <Field>
            <Label>Quality</Label>
            <Select
              items={qualityItems}
              value={settings.quality}
              onValueChange={(value) => {
                if (value) onSettingChange('quality', value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                {qualityItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )
      case 'filesize':
        return (
          <Field>
            <Label>Target File Size (MB)</Label>
            <Input
              type="number"
              min="1"
              max="10240"
              value={settings.targetFilesize || '100'}
              onChange={(e) =>
                onSettingChange('targetFilesize', e.target.value)
              }
              className="w-full"
            />
          </Field>
        )
      case 'bitrate':
        return (
          <Field>
            <Label>Video Bitrate</Label>
            <Select
              items={videoBitrateItems}
              value={settings.videoBitrate}
              onValueChange={(value) => {
                if (value) onSettingChange('videoBitrate', value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select bitrate" />
              </SelectTrigger>
              <SelectContent>
                {videoBitrateItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Compression Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <Field>
            <Label>Compression Method</Label>
            <Select
              items={compressionMethodItems}
              value={settings.compressionMethod}
              onValueChange={(value) => {
                if (value) onSettingChange('compressionMethod', value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {compressionMethodItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {renderCompressionControl()}

          <FieldGroup className="grid grid-cols-2 gap-3">
            <Field>
              <Label>Video Codec</Label>
              <Select
                items={videoCodecItems}
                value={settings.videoCodec}
                onValueChange={(value) => {
                  if (value) onSettingChange('videoCodec', value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {videoCodecItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {settings.videoCodec === 'hevc' && (
                <p className="text-xs text-amber-500">
                  H.265 needs hardware encoder support; falls back to H.264 if
                  unavailable.
                </p>
              )}
            </Field>

            <Field>
              <Label>Audio Bitrate</Label>
              <Select
                items={audioBitrateItems}
                value={settings.audioBitrate}
                onValueChange={(value) => {
                  if (value) onSettingChange('audioBitrate', value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audioBitrateItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <Label>Frame Rate</Label>
              <Select
                items={frameRateItems}
                value={settings.frameRate}
                onValueChange={(value) => {
                  if (value) onSettingChange('frameRate', value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frameRateItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <Field>
            <Label>Max Resolution</Label>
            <Select
              items={resolutionItems}
              value={settings.resolution}
              onValueChange={(value) => {
                if (value) onSettingChange('resolution', value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutionItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Field>
      </CardContent>
    </Card>
  )
}
