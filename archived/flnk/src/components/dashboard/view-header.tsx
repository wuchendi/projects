import { PageHeader } from '@cdlab/ui/shell/layout/page-header'
import type { ReactNode } from 'react'

// A dashboard view's header: the shell's sticky one-row `PageHeader` (space
// icon, title, `actions` on the right) and the view's description under it.
// Render it as the first child of the view's `space-y-*` column.
export function ViewHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <>
      <PageHeader title={title} actions={actions} />
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </>
  )
}
