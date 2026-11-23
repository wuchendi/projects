import { PageHeader } from '@cdlab/ui/shell/layout/page-header'

// The page's header row (the shell's sticky `PageHeader`: space icon, title,
// actions on the right) plus an optional description line under it.
export function SubHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <>
      <PageHeader
        title={title}
        actions={
          children ? (
            <div className="flex items-center gap-2">{children}</div>
          ) : undefined
        }
      />
      {description ? (
        <p className="pt-4 pb-6 text-sm text-muted-foreground">{description}</p>
      ) : (
        <div className="h-6" />
      )}
    </>
  )
}
