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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { Textarea } from '@cdlab/ui/components/textarea'
import { cn } from '@cdlab/ui/lib/utils'
import { copyToClipboard } from '@cdlab/utils'
import {
  Copy,
  Eye,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  deriveKeyPair,
  generateMnemonic,
  sliceAddress,
  validateBase58PublicKey,
  validateMnemonic,
} from '@/lib/keys'
import { hashPin, verifyPin } from '@/lib/pin'
import { useKeysStore } from '@/store/useKeysStore'
import { PinInput } from './PinInput'

interface KeyManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SectionId = 'owner' | 'receiver' | 'password'

async function copy(value: string, msg: string) {
  if (await copyToClipboard(value)) toast.success(msg)
}

export function KeyManagerDialog({
  open,
  onOpenChange,
}: KeyManagerDialogProps) {
  const t = useTranslations('keys')
  const passwordHash = useKeysStore((s) => s.passwordHash)
  const resetAll = useKeysStore((s) => s.resetAll)

  const [unlocked, setUnlocked] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [section, setSection] = useState<SectionId>('owner')

  // Re-lock every time the dialog opens if a PIN is set.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    setAttempt('')
    setSection('owner')
    setUnlocked(open ? !passwordHash : false)
  }

  const locked = !!passwordHash && !unlocked

  const tryUnlock = (value: string) => {
    if (passwordHash && verifyPin(passwordHash, value)) {
      setUnlocked(true)
      setAttempt('')
    } else {
      toast.error(t('lock.incorrect'))
      setAttempt('')
    }
  }

  const sections: { id: SectionId; label: string; Icon: typeof KeyRound }[] = [
    { id: 'owner', label: t('tabs.owner'), Icon: KeyRound },
    { id: 'receiver', label: t('tabs.receiver'), Icon: Users },
    { id: 'password', label: t('tabs.password'), Icon: ShieldCheck },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {locked ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-muted-foreground">{t('lock.hint')}</p>
            <PinInput
              value={attempt}
              onChange={setAttempt}
              onComplete={tryUnlock}
            />
            <div className="flex gap-2">
              <Button
                disabled={attempt.length !== 6}
                onClick={() => tryUnlock(attempt)}
              >
                {t('lock.unlock')}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="ghost" />}>
                  {t('lock.forgot')}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('lock.resetTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('lock.resetDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        resetAll()
                        setUnlocked(true)
                      }}
                    >
                      {t('lock.reset')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
              {sections.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors',
                    section === id
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[24rem] overflow-y-auto pr-1">
              {section === 'owner' && <OwnerKeysTab />}
              {section === 'receiver' && <ReceiverKeysTab />}
              {section === 'password' && <SecurityPasswordTab />}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OwnerKeysTab() {
  const t = useTranslations('keys')
  const keyPairs = useKeysStore((s) => s.keyPairs)
  const addKeyPair = useKeysStore((s) => s.addKeyPair)
  const removeKeyPair = useKeysStore((s) => s.removeKeyPair)

  const [draft, setDraft] = useState<{ mnemonic: string; note: string } | null>(
    null,
  )

  const derived = (() => {
    if (!draft) return null
    const v = validateMnemonic(draft.mnemonic)
    if (!v.isValid) return null
    try {
      return deriveKeyPair(draft.mnemonic).publicKey
    } catch {
      return null
    }
  })()

  const save = () => {
    if (!draft) return
    if (!derived) {
      toast.error(t('owner.invalidMnemonic'))
      return
    }
    addKeyPair({
      publicKey: derived,
      mnemonic: draft.mnemonic.trim().replace(/\s+/g, ' '),
      note: draft.note.trim(),
    })
    toast.success(t('owner.saved'))
    setDraft(null)
  }

  return (
    <div className="space-y-3">
      {!draft && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setDraft({ mnemonic: generateMnemonic(), note: '' })}
          >
            <Plus className="size-4" />
            {t('owner.create')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDraft({ mnemonic: '', note: '' })}
          >
            {t('owner.import')}
          </Button>
        </div>
      )}

      {draft && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t('owner.mnemonic')}</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft((d) =>
                    d ? { ...d, mnemonic: generateMnemonic() } : d,
                  )
                }
              >
                <RefreshCw className="size-3.5" />
                {t('owner.generate')}
              </Button>
            </div>
            <Textarea
              value={draft.mnemonic}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, mnemonic: e.target.value } : d))
              }
              placeholder={t('owner.mnemonicPlaceholder')}
              className="min-h-20 font-mono text-sm"
            />
            {derived && (
              <p className="truncate font-mono text-xs text-muted-foreground">
                {derived}
              </p>
            )}
          </div>
          <Input
            value={draft.note}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, note: e.target.value } : d))
            }
            placeholder={t('notePlaceholder')}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!derived} onClick={save}>
              {t('save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {keyPairs.length === 0 && !draft ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('owner.empty')}
        </p>
      ) : (
        keyPairs.map((k) => (
          <div
            key={k.publicKey}
            className="flex items-center gap-2 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {k.note || t('owner.untitled')}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {sliceAddress(k.publicKey, 10, 10)}
              </p>
            </div>
            {k.mnemonic && (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title={t('owner.view')}
                    />
                  }
                >
                  <Eye className="size-4" />
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    {k.mnemonic.split(' ').map((w, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed word list
                      <span key={i} className="text-muted-foreground">
                        <span className="mr-1 opacity-50">{i + 1}.</span>
                        {w}
                      </span>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => copy(k.publicKey, t('copied'))}
              title={t('copy')}
            >
              <Copy className="size-4" />
            </Button>
            <DeleteButton
              title={t('owner.deleteTitle')}
              description={t('owner.deleteDesc')}
              onConfirm={() => removeKeyPair(k.publicKey)}
            />
          </div>
        ))
      )}
    </div>
  )
}

function ReceiverKeysTab() {
  const t = useTranslations('keys')
  const publicKeys = useKeysStore((s) => s.publicKeys)
  const addPublicKey = useKeysStore((s) => s.addPublicKey)
  const removePublicKey = useKeysStore((s) => s.removePublicKey)

  const [draft, setDraft] = useState<{
    publicKey: string
    note: string
  } | null>(null)

  const save = () => {
    if (!draft) return
    if (!validateBase58PublicKey(draft.publicKey.trim()).isValid) {
      toast.error(t('receiver.invalid'))
      return
    }
    addPublicKey({
      publicKey: draft.publicKey.trim(),
      note: draft.note.trim(),
    })
    toast.success(t('receiver.saved'))
    setDraft(null)
  }

  return (
    <div className="space-y-3">
      {!draft && (
        <Button size="sm" onClick={() => setDraft({ publicKey: '', note: '' })}>
          <Plus className="size-4" />
          {t('receiver.add')}
        </Button>
      )}

      {draft && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <Input
            value={draft.publicKey}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, publicKey: e.target.value } : d))
            }
            placeholder={t('receiver.keyPlaceholder')}
            className="font-mono text-sm"
          />
          <Input
            value={draft.note}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, note: e.target.value } : d))
            }
            placeholder={t('notePlaceholder')}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              {t('save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {publicKeys.length === 0 && !draft ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('receiver.empty')}
        </p>
      ) : (
        publicKeys.map((k) => (
          <div
            key={k.publicKey}
            className="flex items-center gap-2 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {k.note || t('owner.untitled')}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {sliceAddress(k.publicKey, 10, 10)}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => copy(k.publicKey, t('copied'))}
              title={t('copy')}
            >
              <Copy className="size-4" />
            </Button>
            <DeleteButton
              title={t('receiver.deleteTitle')}
              description={t('receiver.deleteDesc')}
              onConfirm={() => removePublicKey(k.publicKey)}
            />
          </div>
        ))
      )}
    </div>
  )
}

function SecurityPasswordTab() {
  const t = useTranslations('keys')
  const passwordHash = useKeysStore((s) => s.passwordHash)
  const setPasswordHash = useKeysStore((s) => s.setPasswordHash)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  const submit = () => {
    if (next.length !== 6 || confirm.length !== 6) return
    if (next !== confirm) {
      toast.error(t('password.mismatch'))
      return
    }
    if (passwordHash && !verifyPin(passwordHash, current)) {
      toast.error(t('lock.incorrect'))
      return
    }
    setPasswordHash(hashPin(next))
    toast.success(passwordHash ? t('password.changed') : t('password.set'))
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  const remove = () => {
    if (passwordHash && !verifyPin(passwordHash, current)) {
      toast.error(t('lock.incorrect'))
      return
    }
    setPasswordHash(null)
    toast.success(t('password.removed'))
    setCurrent('')
  }

  return (
    <div className="max-w-sm space-y-4">
      <p className="text-sm text-muted-foreground">{t('password.everyTime')}</p>
      {passwordHash && (
        <div className="space-y-1.5">
          <Label>{t('password.current')}</Label>
          <PinInput value={current} onChange={setCurrent} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>{t('password.new')}</Label>
        <PinInput value={next} onChange={setNext} />
      </div>
      <div className="space-y-1.5">
        <Label>{t('password.confirm')}</Label>
        <PinInput value={confirm} onChange={setConfirm} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={
            next.length !== 6 ||
            confirm.length !== 6 ||
            (!!passwordHash && current.length !== 6)
          }
          onClick={submit}
        >
          {passwordHash ? t('password.change') : t('password.set')}
        </Button>
        {passwordHash && (
          <Button
            size="sm"
            variant="ghost"
            disabled={current.length !== 6}
            onClick={remove}
          >
            {t('password.remove')}
          </Button>
        )}
      </div>
    </div>
  )
}

function DeleteButton({
  title,
  description,
  onConfirm,
}: {
  title: string
  description: string
  onConfirm: () => void
}) {
  const t = useTranslations('keys')
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
