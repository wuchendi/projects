import { PageHeader } from '@cdlab/ui/shell/layout/page-header'
import type { ReactNode } from 'react'

/**
 * A dashboard page's header for apps on the shared app shell: the shell's
 * sticky one-row `PageHeader` (space icon, title, `tools` right after it —
 * e.g. a search or filter menu — and `actions` on the right) and an optional
 * description under it.
 *
 * Render it as the page's first element. It brings its own gap to the content
 * below (`mb-6`, which also wins over a parent `space-y-*`), and must not be
 * wrapped in another element, or the header stops sticking.
 */
export function IKPageHeader({
  title,
  description,
  tools,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  tools?: ReactNode
  actions?: ReactNode
}) {
  return (
    <>
      <PageHeader title={title} tools={tools} actions={actions} />
      {description ? (
        <p className="mb-6 pt-4 text-sm text-muted-foreground">{description}</p>
      ) : (
        <div aria-hidden="true" className="mb-6" />
      )}
    </>
  )
}
