import { Button } from '@cdlab/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { Field } from '@cdlab/ui/components/field'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import { PasswordInput } from '@cdlab/ui/components/password-input'
import { Textarea } from '@cdlab/ui/components/textarea'
import { cn } from '@cdlab/ui/lib/utils'
import { formatFileSize } from '@cdlab/utils'
import { KeyRound, Lock, Unlock, Upload, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { RefObject } from 'react'
import { sliceAddress } from '@/lib/keys'
import type { FileInfo } from '@/types/crypto'
import { InputModeEnum, ModeEnum } from '@/types/crypto'
import type { EncryptionMode, KeyPair, PublicKey } from '@/types/keys'

interface LocalInputPanelProps {
  mode: ModeEnum
  inputMode: InputModeEnum
  password: string
  onPasswordChange: (value: string) => void
  fileInfos: FileInfo[]
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileSelect: (files: File[]) => void
  onRemoveFile: (index: number) => void
  textInput: string
  onTextInputChange: (value: string) => void
  onProcess: () => void
  isProcessDisabled: boolean
  encryptionMode: EncryptionMode
  keyInput: string
  onKeyInputChange: (value: string) => void
  savedKeys: (PublicKey | KeyPair)[]
}

export function LocalInputPanel({
  mode,
  inputMode,
  password,
  onPasswordChange,
  fileInfos,
  fileInputRef,
  onFileSelect,
  onRemoveFile,
  textInput,
  onTextInputChange,
  onProcess,
  isProcessDisabled,
  encryptionMode,
  keyInput,
  onKeyInputChange,
  savedKeys,
}: LocalInputPanelProps) {
  const t = useTranslations('localCrypto')
  const tk = useTranslations('keys')
  const isEncrypt = mode === ModeEnum.ENCRYPT
  const hasFiles = fileInfos.length > 0
  const hasInput =
    inputMode === InputModeEnum.FILE ? hasFiles : textInput.trim().length > 0

  return (
    <>
      <Input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) {
            onFileSelect(Array.from(files))
          }
          e.target.value = ''
        }}
      />

      <div className="space-y-4">
        <Field>
          {inputMode === InputModeEnum.FILE ? (
            <>
              <div
                className={cn(
                  'group relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed transition-colors duration-200',
                  hasFiles
                    ? 'border-primary/50 bg-muted/40'
                    : 'border-border hover:border-primary/50 hover:bg-muted/40',
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const files = e.dataTransfer.files
                  if (files.length > 0) {
                    onFileSelect(Array.from(files))
                  }
                }}
              >
                <div className="flex min-h-40 flex-col items-center justify-center space-y-2">
                  <Upload
                    className={cn(
                      'size-8 transition-colors duration-300',
                      hasFiles
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-primary',
                    )}
                  />
                  <span
                    className={cn(
                      'text-center text-sm font-medium transition-colors duration-300',
                      hasFiles
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    {hasFiles
                      ? fileInfos.length === 1
                        ? fileInfos[0].name
                        : `${fileInfos.length} files selected`
                      : t('input.clickToSelect')}
                  </span>
                </div>
              </div>

              {hasFiles && (
                <div className="mt-2 space-y-1.5">
                  {fileInfos.map((info, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: file list order is stable during display
                      key={index}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs"
                    >
                      <span className="flex-1 truncate font-medium text-foreground">
                        {info.name}
                      </span>
                      <span className="font-mono ml-3 shrink-0 text-muted-foreground">
                        {formatFileSize(info.size)}
                      </span>
                      <button
                        type="button"
                        className="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveFile(index)
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Textarea
              value={textInput}
              onChange={(e) => onTextInputChange(e.target.value)}
              placeholder={
                isEncrypt
                  ? t('input.messagePlaceholderEncrypt')
                  : t('input.messagePlaceholderDecrypt')
              }
              className="min-h-40 max-h-75 text-sm"
            />
          )}
        </Field>

        {/* Key + action only appear once there's something to process. */}
        {hasInput && (
          <>
            {encryptionMode === 'password' ? (
              <Field>
                <Label>{t('input.password')}</Label>
                <PasswordInput
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder={t('input.passwordPlaceholder')}
                />
              </Field>
            ) : (
              <Field>
                <Label>
                  {isEncrypt ? tk('publicKeyLabel') : tk('privateKeyLabel')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={keyInput}
                    onChange={(e) => onKeyInputChange(e.target.value)}
                    placeholder={
                      isEncrypt
                        ? tk('publicKeyPlaceholder')
                        : tk('privateKeyPlaceholder')
                    }
                    className="font-mono text-sm"
                  />
                  {savedKeys.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="icon"
                            variant="outline"
                            title={tk('useSavedKey')}
                          />
                        }
                      >
                        <KeyRound className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-w-80">
                        {savedKeys.map((k) => (
                          <DropdownMenuItem
                            key={k.publicKey}
                            onClick={() =>
                              onKeyInputChange(
                                'mnemonic' in k && k.mnemonic
                                  ? k.mnemonic
                                  : k.publicKey,
                              )
                            }
                          >
                            <span className="truncate">
                              {k.note || sliceAddress(k.publicKey, 8, 8)}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </Field>
            )}

            <div className="flex">
              <Button
                variant="default"
                disabled={isProcessDisabled}
                onClick={onProcess}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isEncrypt ? (
                  <>
                    <Lock />
                    {t('input.encrypt')}
                  </>
                ) : (
                  <>
                    <Unlock />
                    {t('input.decrypt')}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
