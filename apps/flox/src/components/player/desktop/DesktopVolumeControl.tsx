import { Button } from '@cdlab/ui/components/button'
import { Slider } from '@cdlab/ui/components/slider'
import { Volume1, Volume2, VolumeX } from 'lucide-react'

interface DesktopVolumeControlProps {
  volume: number
  isMuted: boolean
  showVolumeBar: boolean
  onToggleMute: () => void
  onVolumeValueChange: (v: number) => void
}

export function DesktopVolumeControl({
  volume,
  isMuted,
  showVolumeBar,
  onToggleMute,
  onVolumeValueChange,
}: DesktopVolumeControlProps) {
  const current = isMuted ? 0 : volume
  return (
    <div className="flex items-center gap-2 group/volume">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggleMute}
        className="text-white/90 hover:text-white hover:bg-white/10"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="size-5" />
        ) : volume < 0.5 ? (
          <Volume1 className="size-5" />
        ) : (
          <Volume2 className="size-5" />
        )}
      </Button>

      {/* Volume Bar */}
      <div
        className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${
          showVolumeBar
            ? 'opacity-100 w-32'
            : 'opacity-0 w-0 group-hover/volume:opacity-100 group-hover/volume:w-32'
        }`}
      >
        <Slider
          value={[current]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={(v) =>
            onVolumeValueChange(Array.isArray(v) ? v[0] : v)
          }
          aria-label="音量"
          className="flex-1"
        />
        <span className="text-white text-xs font-medium tabular-nums min-w-[2rem]">
          {Math.round(current * 100)}
        </span>
      </div>
    </div>
  )
}
