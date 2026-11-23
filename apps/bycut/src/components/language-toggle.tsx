'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { cn } from '@cdlab/ui/lib/utils'
import { Check, Languages } from 'lucide-react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
] as const

interface LanguageToggleProps {
  className?: string
  iconClassName?: string
}

export function LanguageToggle({
  className,
  iconClassName,
}: LanguageToggleProps) {
  const currentLanguage = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            type="button"
            className={cn('size-8', className)}
          />
        }
      >
        <Languages className={cn('!size-[1.1rem]', iconClassName)} />
        <span className="sr-only">Switch language</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            className="flex items-center justify-between gap-2"
            onClick={() => router.replace(pathname, { locale: language.code })}
          >
            {language.label}
            {currentLanguage === language.code && (
              <Check className="size-3.5" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
