'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { GitHubIcon } from '@cdlab/ui/icon/GitHubIcon'
import {
  BookOpen,
  Languages,
  LogOut,
  Palette,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useTransition } from 'react'
import type { Locale } from '@/i18n/config'
import { localeLabels, locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale'
import { authClient } from '@/lib/platform/auth-client'

const DOCS_HREF =
  'https://github.com/WuChenDi/projects/blob/main/archived/flnk/README.md'
const REPO_HREF = 'https://github.com/WuChenDi/projects/tree/main/archived/flnk'

function initials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || '?'
  const parts = source.split(/\s+/u).filter(Boolean)
  const letters =
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)
  return letters.toUpperCase()
}

function Avatar({
  image,
  name,
  email,
}: {
  image?: string | null
  name?: string | null
  email?: string | null
}) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-medium text-primary">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small remote OAuth avatar; next/image adds no value (images.unoptimized)
        // biome-ignore lint/performance/noImgElement: small remote OAuth avatar; next/image adds no value (images.unoptimized)
        <img src={image} alt="" className="size-full object-cover" />
      ) : (
        initials(name, email)
      )}
    </span>
  )
}

// The account control at the foot of the shell rail.
export function NavUser() {
  const t = useTranslations('userMenu')
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const locale = useLocale()
  const [, startTransition] = useTransition()
  const { data: session, isPending } = authClient.useSession()

  const user = session?.user
  const name = user?.name
  const email = user?.email

  function onLocaleChange(value: string) {
    startTransition(async () => {
      await setUserLocale(value as Locale)
      router.refresh()
    })
  }

  async function onSignOut() {
    await authClient.signOut()
    router.replace('/')
  }

  if (isPending || !user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={name || email || undefined}
        className="grid size-9 place-items-center rounded-md outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-foreground/[0.07]"
      >
        <Avatar image={user.image} name={name} email={email} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side="right"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="size-4" />
            {t('theme')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                {t('light')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                {t('dark')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                {t('system')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="size-4" />
            {t('language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={onLocaleChange}
            >
              {locales.map((l) => (
                <DropdownMenuRadioItem key={l} value={l}>
                  {localeLabels[l]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href={DOCS_HREF} target="_blank" rel="noopener noreferrer" />}>
          <BookOpen className="size-4" />
          {t('docs')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={REPO_HREF} target="_blank" rel="noopener noreferrer" />}>
          <GitHubIcon className="size-4" />
          {t('repo')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void onSignOut()}>
          <LogOut className="size-4" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
