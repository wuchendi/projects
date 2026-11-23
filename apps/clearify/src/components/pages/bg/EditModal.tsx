'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import { Label } from '@cdlab/ui/components/label'
import { Slider } from '@cdlab/ui/components/slider'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cdlab/ui/components/tabs'
import {
  Check,
  CircleDot,
  Grid3X3,
  Image as ImageIcon,
  LineChart,
  Palette,
  Upload,
  Waves,
  Zap,
} from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import type { BgImageFile } from '@/types'

interface EditModalProps {
  image: BgImageFile
  isOpen: boolean
  onClose: () => void
  onSave: (url: string) => void
}

const backgroundOptions = [
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'pattern', label: 'Pattern', icon: Grid3X3 },
]

const effectOptions = [
  { id: 'none', label: 'None', icon: Check },
  { id: 'blur', label: 'Blur', icon: Zap },
  { id: 'brightness', label: 'Bright', icon: Zap },
  { id: 'contrast', label: 'Contrast', icon: Zap },
]

const predefinedColors = [
  '#ffffff',
  '#000000',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#00ffff',
  '#ff00ff',
  '#808080',
  '#c0c0c0',
]

const predefinedPatterns = [
  {
    id: 'dots',
    label: 'Dots',
    icon: CircleDot,
    generate: (canvas: HTMLCanvasElement, color: string = '#333333') => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = color
      const dotSize = 4
      const spacing = 20

      for (let x = 0; x < canvas.width; x += spacing) {
        for (let y = 0; y < canvas.height; y += spacing) {
          ctx.beginPath()
          ctx.arc(x, y, dotSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    },
  },
  {
    id: 'lines',
    label: 'Lines',
    icon: LineChart,
    generate: (canvas: HTMLCanvasElement, color: string = '#333333') => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      const spacing = 20

      for (
        let i = -canvas.height;
        i < canvas.width + canvas.height;
        i += spacing
      ) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i - canvas.height, canvas.height)
        ctx.stroke()
      }
    },
  },
  {
    id: 'grid',
    label: 'Grid',
    icon: Grid3X3,
    generate: (canvas: HTMLCanvasElement, color: string = '#333333') => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = color
      ctx.lineWidth = 1
      const spacing = 20

      for (let x = 0; x < canvas.width; x += spacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      for (let y = 0; y < canvas.height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    },
  },
  {
    id: 'waves',
    label: 'Waves',
    icon: Waves,
    generate: (canvas: HTMLCanvasElement, color: string = '#333333') => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = color
      ctx.lineWidth = 3
      const amplitude = 20
      const frequency = 0.01
      const spacing = 30

      for (let y = 0; y < canvas.height; y += spacing) {
        ctx.beginPath()
        for (let x = 0; x < canvas.width; x++) {
          const yOffset = Math.sin(x * frequency) * amplitude
          if (x === 0) {
            ctx.moveTo(x, y + yOffset)
          } else {
            ctx.lineTo(x, y + yOffset)
          }
        }
        ctx.stroke()
      }
    },
  },
]

export function EditModal({ image, isOpen, onClose, onSave }: EditModalProps) {
  const [bgType, setBgType] = useState('color')
  const [bgColor, setBgColor] = useState('#000000')
  const [customBgImage, setCustomBgImage] = useState<File | null>(null)
  const [selectedEffect, setSelectedEffect] = useState('none')
  const [blurValue, setBlurValue] = useState(50)
  const [brightnessValue, setBrightnessValue] = useState(50)
  const [contrastValue, setContrastValue] = useState(50)
  const [exportUrl, setExportUrl] = useState('')
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false)
  const [selectedPattern, setSelectedPattern] = useState('dots')

  const processedURL = image.processedUrl || ''

  const getCurrentEffectValue = () => {
    switch (selectedEffect) {
      case 'blur':
        return blurValue
      case 'brightness':
        return brightnessValue
      case 'contrast':
        return contrastValue
      default:
        return 50
    }
  }

  const handleEffectValueChange = (value: number | readonly number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value
    switch (selectedEffect) {
      case 'blur':
        setBlurValue(newValue)
        break
      case 'brightness':
        setBrightnessValue(newValue)
        break
      case 'contrast':
        setContrastValue(newValue)
        break
    }
  }

  const applyChanges = useCallback(async () => {
    if (!image.processedUrl) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new window.Image()
    img.src = processedURL
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load processed image'))
      setTimeout(() => reject(new Error('Image load timeout')), 10000)
    }).catch(() => {})

    if (!img.width || !img.height) return

    canvas.width = img.width
    canvas.height = img.height

    // Apply background
    if (bgType === 'color') {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else if (bgType === 'image' && customBgImage) {
      const bgUrl = URL.createObjectURL(customBgImage)
      const bgImg = new window.Image()
      bgImg.src = bgUrl
      await new Promise<void>((resolve) => {
        bgImg.onload = () => resolve()
        bgImg.onerror = () => resolve()
        setTimeout(() => resolve(), 10000)
      })
      URL.revokeObjectURL(bgUrl)
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)
    } else if (bgType === 'pattern') {
      const pattern = predefinedPatterns.find((p) => p.id === selectedPattern)
      if (pattern) {
        pattern.generate(canvas, bgColor)
      }
    }

    // Draw the processed image
    ctx.drawImage(img, 0, 0)

    // Apply effects
    if (selectedEffect !== 'none') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      switch (selectedEffect) {
        case 'blur': {
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')
          if (!tempCtx) break

          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          tempCtx.drawImage(canvas, 0, 0)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.filter = `blur(${blurValue / 10}px)`
          ctx.drawImage(tempCanvas, 0, 0)
          ctx.filter = 'none'
          break
        }

        case 'brightness':
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * (brightnessValue / 50))
            data[i + 1] = Math.min(255, data[i + 1] * (brightnessValue / 50))
            data[i + 2] = Math.min(255, data[i + 2] * (brightnessValue / 50))
          }
          ctx.putImageData(imageData, 0, 0)
          break

        case 'contrast': {
          const factor =
            (259 * (contrastValue + 255)) / (255 * (259 - contrastValue))
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128))
            data[i + 1] = Math.max(
              0,
              Math.min(255, factor * (data[i + 1] - 128) + 128),
            )
            data[i + 2] = Math.max(
              0,
              Math.min(255, factor * (data[i + 2] - 128) + 128),
            )
          }
          ctx.putImageData(imageData, 0, 0)
          break
        }
      }
    }

    const dataUrl = canvas.toDataURL('image/png')
    setExportUrl(dataUrl)
  }, [
    image.processedUrl,
    processedURL,
    bgType,
    bgColor,
    customBgImage,
    selectedPattern,
    selectedEffect,
    blurValue,
    brightnessValue,
    contrastValue,
  ])

  // Only auto-apply on initial image load, not on every parameter change
  // Users click "Apply Changes" button for subsequent updates
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only trigger on processedUrl change
  useEffect(() => {
    if (image.processedUrl) {
      void applyChanges()
    }
  }, [image.processedUrl])

  const handleSave = () => {
    onSave(exportUrl)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-xl! max-h-[90vh] overflow-y-auto"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left side - Controls */}
          <div className="space-y-6">
            {/* Background Settings */}
            <div>
              <Label className="mb-3">Background</Label>
              <Tabs
                value={bgType}
                onValueChange={(value) => setBgType(value as string)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  {backgroundOptions.map((option) => (
                    <TabsTrigger key={option.id} value={option.id}>
                      <option.icon className="size-4 mr-1" />
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="color" className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBgColor(color)}
                        className={`w-8 h-8 rounded-md transition-all ${
                          bgColor === color
                            ? 'ring-2 ring-primary ring-offset-2'
                            : 'ring-1 ring-border'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Color ${color}`}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setShowCustomColorPicker(!showCustomColorPicker)
                    }
                  >
                    <Palette className="size-4 mr-2" />
                    Custom Color
                  </Button>
                  {showCustomColorPicker && (
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-full h-10 rounded"
                    />
                  )}
                </TabsContent>

                <TabsContent value="image" className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      document.getElementById('bg-image-upload')?.click()
                    }
                  >
                    <Upload className="size-4 mr-2" />
                    Upload Image
                  </Button>
                  <input
                    id="bg-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setCustomBgImage(e.target.files?.[0] || null)
                    }
                    className="hidden"
                  />
                  {customBgImage && (
                    <p className="text-sm text-muted-foreground truncate">
                      {customBgImage.name}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="pattern" className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {predefinedPatterns.map((pattern) => (
                      <Button
                        key={pattern.id}
                        type="button"
                        variant={
                          selectedPattern === pattern.id ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => setSelectedPattern(pattern.id)}
                      >
                        <pattern.icon className="size-4 mr-1" />
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs mb-2">Pattern Color</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {predefinedColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBgColor(color)}
                          className={`w-6 h-6 rounded-md transition-all ${
                            bgColor === color
                              ? 'ring-2 ring-primary ring-offset-2'
                              : 'ring-1 ring-border'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Pattern color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Effects Settings */}
            <div>
              <Label className="mb-3">Effects</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {effectOptions.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={
                      selectedEffect === option.id ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setSelectedEffect(option.id)}
                  >
                    <option.icon className="size-4 mr-1" />
                    {option.label}
                  </Button>
                ))}
              </div>

              {selectedEffect !== 'none' && (
                <div className="space-y-2">
                  <Slider
                    value={[getCurrentEffectValue()]}
                    onValueChange={handleEffectValueChange}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>{getCurrentEffectValue()}</span>
                    <span>100</span>
                  </div>
                </div>
              )}
            </div>

            {/* Apply Changes Button */}
            <Button
              type="button"
              onClick={() => void applyChanges()}
              className="w-full"
            >
              Apply Changes
            </Button>
          </div>

          {/* Right side - Preview */}
          <div>
            <Label className="mb-3">Preview</Label>
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {exportUrl || processedURL ? (
                <Image
                  src={exportUrl || processedURL}
                  alt="Preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Processing preview...
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
