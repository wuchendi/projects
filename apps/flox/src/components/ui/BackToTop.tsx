'use client'

import { Button } from '@cdlab/ui/components/button'
import { cn } from '@cdlab/ui/lib/utils'
import { ChevronUpIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let viewport: Element | null = null

    const toggleVisibility = () => {
      setIsVisible((viewport?.scrollTop ?? 0) > 300)
    }

    const attach = () => {
      viewport = document.querySelector('[data-slot="scroll-area-viewport"]')
      if (!viewport) return false
      viewport.addEventListener('scroll', toggleVisibility, { passive: true })
      toggleVisibility()
      return true
    }

    if (!attach()) {
      const observer = new MutationObserver(() => {
        if (attach()) observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
      return () => observer.disconnect()
    }

    return () => viewport?.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]',
    )
    viewport?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={scrollToTop}
      aria-label="返回顶部"
      title="返回顶部"
      className={cn(
        'fixed bottom-8 right-8 rounded-full transition-all duration-300 box-border',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-10 pointer-events-none',
      )}
    >
      <ChevronUpIcon className="size-4" />
    </Button>
  )
}
