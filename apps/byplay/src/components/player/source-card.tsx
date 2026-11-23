'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cdlab/ui/components/input-group'
import { ClipboardPaste } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

const VIDL_URL = 'https://vidl.pages.dev'

interface SourceCardProps {
  url: string
  isLoading: boolean
  onUrlChange: (url: string) => void
  onLoad: () => void
}

export function SourceCard({
  url,
  isLoading,
  onUrlChange,
  onLoad,
}: SourceCardProps) {
  const t = useTranslations('source')
  const locale = useLocale()

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) return
      onUrlChange(text.trim())
    } catch {
      toast.error(t('batch.clipboardError'))
    }
  }, [onUrlChange, t])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <InputGroup>
          <InputGroupInput
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder={t('placeholder')}
            onKeyDown={(e) => e.key === 'Enter' && onLoad()}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" onClick={handlePaste}>
              <ClipboardPaste />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </CardContent>
      <CardFooter>
        <div className="flex flex-row gap-2 w-full">
          <Button
            onClick={onLoad}
            disabled={isLoading || !url.trim()}
            className="flex-1"
          >
            {isLoading ? t('loading') : t('load')}
          </Button>
          {url.trim() ? (
            <Button
              variant="outline"
              className="flex-1"
              nativeButton={false}
              render={
                <a
                  href={`${VIDL_URL}/${locale}?url=${encodeURIComponent(url.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              {t('downloadVideo')}
            </Button>
          ) : (
            <Button variant="outline" disabled className="flex-1">
              {t('downloadVideo')}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
