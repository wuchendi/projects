'use client'

import { Button } from '@cdlab/ui/components/button'
import { IKFooter } from '@cdlab/ui/IK/IKFooter'
import { GitHubIcon } from '@cdlab/ui/icon/GitHubIcon'
import { FileText, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { useCryptoProcessor } from '@/hooks/useCryptoProcessor'
import { InputModeEnum } from '@/types/crypto'

const REPO_URL =
  'https://github.com/WuChenDi/projects/tree/main/apps/dropply-web'

const linkClass =
  'h-auto gap-1.5 p-0 text-foreground/80 no-underline hover:text-foreground hover:no-underline'

interface AppFooterProps {
  crypto: ReturnType<typeof useCryptoProcessor>
}

export function AppFooter({ crypto }: AppFooterProps) {
  const t = useTranslations('landing.footer')

  // Mirror nsio: footer tool links switch the input mode and scroll back up to
  // the tool (the page scrolls inside the shared ScrollArea viewport).
  const selectTool = (mode: InputModeEnum) => {
    crypto.setInputMode(mode)
    document
      .querySelector('[data-slot="scroll-area-viewport"]')
      ?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs space-y-3">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Dropply
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('tagline')}
            </p>
            <p className="text-xs text-muted-foreground/80">{t('trust')}</p>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-10">
            <nav className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                {t('tool')}
              </p>
              <ul className="space-y-2">
                <li>
                  <Button
                    variant="link"
                    className={linkClass}
                    onClick={() => selectTool(InputModeEnum.FILE)}
                  >
                    <Upload className="size-4" />
                    {t('toolFile')}
                  </Button>
                </li>
                <li>
                  <Button
                    variant="link"
                    className={linkClass}
                    onClick={() => selectTool(InputModeEnum.MESSAGE)}
                  >
                    <FileText className="size-4" />
                    {t('toolMessage')}
                  </Button>
                </li>
              </ul>
            </nav>
            <nav className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                {t('project')}
              </p>
              <ul className="space-y-2">
                <li>
                  <Button
                    variant="link"
                    className={linkClass}
                    nativeButton={false}
                    render={
                      <a
                        href={REPO_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                      />
                    }
                  >
                    <GitHubIcon className="size-4" />
                    {t('github')}
                  </Button>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs! text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono [&>footer]:w-auto [&>footer]:py-0 [&>footer]:text-xs [&>footer]:text-muted-foreground/70 [&>footer>div]:justify-start">
            <IKFooter year={2025} />
          </div>
          <span className="font-mono text-muted-foreground/70">
            {t('builtWith')}
          </span>
        </div>
      </div>
    </footer>
  )
}
