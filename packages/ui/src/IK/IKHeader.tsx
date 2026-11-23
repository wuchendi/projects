import { Button } from '@cdlab/ui/components/button'
import { GitHubIcon as Github } from '@cdlab/ui/icon'
import { ExternalLinkIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface IKHeaderProps {
  brand: string
  githubHref: string
  children?: ReactNode
}

export function IKHeader({ brand, githubHref, children }: IKHeaderProps) {
  return (
    <header className="relative w-full z-10">
      <div className="flex h-20 px-4 md:px-6 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear">
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <img
              src="https://wcd.pages.dev/logo.png"
              alt="Chendi Wu Logo"
              width={32}
              height={32}
              className="rounded-full mr-2"
            />
            {brand.split('').map((letter, index) => (
              <span
                key={index}
                className="hover:text-primary hover:-mt-2 transition-all duration-500 hover:duration-100"
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </a>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="https://wcd.pages.dev/projects/"
              className="transition-colors flex items-center gap-1 uppercase"
            >
              more
              <ExternalLinkIcon className="size-4" />
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {children}
            <Button
              variant="outline"
              size="icon"
              aria-label="GitHub"
              nativeButton={false}
              render={
                <a
                  href={githubHref}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Github className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
