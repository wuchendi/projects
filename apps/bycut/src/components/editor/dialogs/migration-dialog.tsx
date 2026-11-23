'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEditor } from '@/hooks/use-editor'

export function MigrationDialog() {
  const t = useTranslations()
  const editor = useEditor()
  const migrationState = editor.project.getMigrationState()

  if (!migrationState.isMigrating) return null

  const title = migrationState.projectName
    ? t('projects.updatingProject')
    : t('projects.updating')
  const description = migrationState.projectName
    ? t('projects.upgradingNamed', {
        name: migrationState.projectName,
        from: migrationState.fromVersion ?? 0,
        to: migrationState.toVersion ?? 0,
      })
    : t('projects.upgrading', {
        from: migrationState.fromVersion ?? 0,
        to: migrationState.toVersion ?? 0,
      })

  return (
    <Dialog
      open={true}
      onOpenChange={(_open, eventDetails) => {
        if (
          eventDetails.reason === 'outside-press' ||
          eventDetails.reason === 'escape-key'
        ) {
          eventDetails.cancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-4">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
