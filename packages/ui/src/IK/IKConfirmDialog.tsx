import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@cdlab/ui/components/alert-dialog'
import { OctagonAlert } from 'lucide-react'

interface IKConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  onConfirm: () => void
  isPending?: boolean
  confirmText?: string
  cancelText?: string
  extraButton?: {
    text: string
    onClick: () => void
    variant?:
      | 'default'
      | 'secondary'
      | 'destructive'
      | 'outline'
      | 'ghost'
      | 'link'
    disabled?: boolean
  }
}

export function IKConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isPending = false,
  confirmText = '确认',
  cancelText = '取消',
  extraButton,
}: IKConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card ring-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <OctagonAlert className="h-5 w-5 text-destructive" />
            <span>{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription
            render={<div className="text-sm text-muted-foreground" />}
          >
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="secondary">
            {cancelText}
          </AlertDialogCancel>
          {extraButton && (
            <AlertDialogAction
              variant={extraButton.variant || 'secondary'}
              onClick={extraButton.onClick}
              disabled={extraButton.disabled}
            >
              {extraButton.text}
            </AlertDialogAction>
          )}
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? `${confirmText}中...` : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
