import { Button } from '@cdlab/ui/components/button'
import { Progress } from '@cdlab/ui/components/progress'
import { formatFileSize } from '@cdlab/utils'
import { AlertTriangle, FileVideo, Upload } from 'lucide-react'
import type { RefObject } from 'react'

interface ProcessingViewProps {
  video: File | null
  previewUrl: string
  isProcessing: boolean
  progress: number
  error: string | null
  outputUrl: string
  processedSize: number | null
  videoRef: RefObject<HTMLVideoElement | null>
  previewRef: RefObject<HTMLVideoElement | null>
}

export function ProcessingView({
  video,
  previewUrl,
  isProcessing,
  progress,
  error,
  outputUrl,
  processedSize,
  videoRef,
  previewRef,
}: ProcessingViewProps) {
  if (!video) {
    return (
      <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed rounded-lg">
        <div className="text-center space-y-3">
          <FileVideo className="size-16 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No video selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Waiting State */}
      {!isProcessing && !outputUrl && (
        <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <Upload className="size-16 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              Ready to compress
            </p>
            <p className="text-xs text-muted-foreground">
              Click "Compress Video" button on the left to start
            </p>
          </div>
        </div>
      )}

      {/* Size Comparison */}
      {(isProcessing || outputUrl) && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Original</p>
            <p className="text-xl font-bold">{formatFileSize(video.size)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Compressed</p>
            <p className="text-xl font-bold">
              {processedSize ? formatFileSize(processedSize) : '0.0'}
            </p>
          </div>
        </div>
      )}

      {/* Processing Preview */}
      {isProcessing && (
        <div className="space-y-4">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={previewUrl}
              className="absolute inset-0 w-full h-full object-contain opacity-50"
              muted
            />
            <video
              ref={previewRef}
              src={previewUrl}
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                clipPath: `inset(0 ${100 - progress}% 0 0)`,
              }}
              muted
            />
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground">
            Compressing... {progress}%
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && !isProcessing && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-4 rounded-lg">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Result Video */}
      {outputUrl && (
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={outputUrl}
              controls
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Saved{' '}
              {processedSize &&
                ((1 - processedSize / video.size) * 100).toFixed(0)}
              % of original size
            </span>
            <Button
              nativeButton={false}
              render={<a href={outputUrl} download="compressed-video.mp4" />}
            >
              Download Video
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
