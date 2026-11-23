'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@cdlab/ui/components/alert-dialog'
import { Button } from '@cdlab/ui/components/button'

interface Props {
  title: string
  message: string
  onConfirm: () => void
  disabled?: boolean
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'ghost' | 'outline' | 'destructive' | 'secondary' | 'default'
  children: React.ReactNode
}

export function ConfirmDeleteButton({
  title,
  message,
  onConfirm,
  disabled,
  size = 'icon',
  variant = 'ghost',
  children,
}: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant={variant}
            size={size}
            aria-label="删除"
            disabled={disabled}
            className="text-destructive hover:text-destructive"
          />
        }
      >
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>确认删除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
