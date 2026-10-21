'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import { Field } from '@cdlab/ui/components/field'
import { Input } from '@cdlab/ui/components/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from '@cdlab/ui/components/input-group'
import { Label } from '@cdlab/ui/components/label'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, Loader2, Mail, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { PocketChestAPI } from '@/lib'
import type { EmailShareRequest } from '@/types'

interface EmailShareProps {
  retrievalCode: string
  isVisible: boolean
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EmailShare({
  retrievalCode,
  isVisible,
  onClose,
}: EmailShareProps) {
  const t = useTranslations('email')
  const [sent, setSent] = useState(false)

  const sendMutation = useMutation({
    mutationFn: async (value: {
      recipientEmail: string
      recipientName: string
      senderName: string
      message: string
    }) => {
      const requestData: EmailShareRequest = {
        retrievalCode,
        recipientEmail: value.recipientEmail.trim(),
        recipientName: value.recipientName.trim() || undefined,
        senderName: value.senderName.trim() || undefined,
        message: value.message.trim() || undefined,
      }
      const result = await new PocketChestAPI().shareViaEmail(requestData)
      if (!result.sent) throw new Error(result.message)
      return result
    },
    onSuccess: () => {
      setSent(true)
      setTimeout(() => {
        onClose()
        reset()
      }, 2000)
    },
  })

  const form = useForm({
    defaultValues: {
      recipientEmail: '',
      recipientName: '',
      senderName: '',
      message: '',
    },
    onSubmit: async ({ value }) => {
      await sendMutation.mutateAsync(value)
    },
  })

  const reset = () => {
    form.reset()
    setSent(false)
    sendMutation.reset()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !sendMutation.isPending) {
      onClose()
      reset()
    }
  }

  return (
    <Dialog open={isVisible} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            <DialogTitle>{t('title')}</DialogTitle>
          </div>
          <DialogDescription>{t('securityNote')}</DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="size-12 text-emerald-500" />
            <p className="text-lg font-semibold">{t('sentTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('sentMessage')}</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            {sendMutation.isError && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {sendMutation.error instanceof Error
                  ? sendMutation.error.message
                  : t('sendFailed')}
              </p>
            )}

            <div className="space-y-4">
              <form.Field
                name="recipientEmail"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim()
                      ? t('recipientEmailRequired')
                      : EMAIL_RE.test(value.trim())
                        ? undefined
                        : t('recipientEmailInvalid'),
                }}
              >
                {(field) => (
                  <Field>
                    <Label htmlFor={field.name}>{t('recipientEmail')}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('recipientEmailPlaceholder')}
                      disabled={sendMutation.isPending}
                      aria-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                      autoFocus
                    />
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0 && (
                        <p className="text-xs text-destructive">
                          {field.state.meta.errors[0]}
                        </p>
                      )}
                  </Field>
                )}
              </form.Field>

              <div className="grid grid-cols-2 gap-3">
                <form.Field name="recipientName">
                  {(field) => (
                    <Field>
                      <Label htmlFor={field.name}>{t('theirName')}</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t('theirNamePlaceholder')}
                        disabled={sendMutation.isPending}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="senderName">
                  {(field) => (
                    <Field>
                      <Label htmlFor={field.name}>{t('yourName')}</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t('yourNamePlaceholder')}
                        disabled={sendMutation.isPending}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>

              <form.Field name="message">
                {(field) => (
                  <Field>
                    <Label htmlFor={field.name}>{t('personalMessage')}</Label>
                    <InputGroup>
                      <InputGroupTextarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t('messagePlaceholder')}
                        className=" resize-none break-all"
                        maxLength={500}
                        disabled={sendMutation.isPending}
                      />
                      <InputGroupAddon align="block-end" className="border-t">
                        <InputGroupText className="text-xs text-muted-foreground">
                          {t('messageHint')}
                        </InputGroupText>
                        <InputGroupText className="ml-auto text-xs text-muted-foreground">
                          {field.state.value.length}/500
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                )}
              </form.Field>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={sendMutation.isPending}
              >
                {t('cancel')}
              </Button>
              <form.Subscribe selector={(state) => state.canSubmit}>
                {(canSubmit) => (
                  <Button
                    type="submit"
                    disabled={!canSubmit || sendMutation.isPending}
                  >
                    {sendMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('sending')}
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        {t('sendEmail')}
                      </>
                    )}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
