'use client'

import { Button } from '@cdlab/ui/components/button'
import { Checkbox } from '@cdlab/ui/components/checkbox'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { Power, PowerOff, Tag, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface LinksBulkBarProps {
  selectedCount: number
  allSelected: boolean
  onToggleAll: (on: boolean) => void
  onEnable: () => void
  onDisable: () => void
  bulkTogglePending: boolean
  bulkTagDraft: string
  onBulkTagDraftChange: (value: string) => void
  onBulkTagAdd: () => void
  onBulkTagRemove: () => void
  bulkTagPending: boolean
  onDeleteClick: () => void
  onClear: () => void
}

export function LinksBulkBar({
  selectedCount,
  allSelected,
  onToggleAll,
  onEnable,
  onDisable,
  bulkTogglePending,
  bulkTagDraft,
  onBulkTagDraftChange,
  onBulkTagAdd,
  onBulkTagRemove,
  bulkTagPending,
  onDeleteClick,
  onClear,
}: LinksBulkBarProps) {
  const t = useTranslations('links')
  const tc = useTranslations('common')

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <Checkbox
        checked={allSelected}
        onCheckedChange={(v) => onToggleAll(v === true)}
        aria-label={t('selectAll')}
      />
      <span className="font-medium">
        {t('selectedCount', { count: selectedCount })}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={bulkTogglePending}
          onClick={onEnable}
        >
          <Power className="size-4" />
          {t('enable')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={bulkTogglePending}
          onClick={onDisable}
        >
          <PowerOff className="size-4" />
          {t('disable')}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Tag className="size-4" />
              {t('tagAction')}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-2">
            <Label>{t('bulkTagLabel')}</Label>
            <Input
              value={bulkTagDraft}
              onChange={(e) => onBulkTagDraftChange(e.target.value)}
              placeholder={t('form.addTag')}
              maxLength={32}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={!bulkTagDraft.trim() || bulkTagPending}
                onClick={onBulkTagAdd}
              >
                {t('bulkTagAdd')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={!bulkTagDraft.trim() || bulkTagPending}
                onClick={onBulkTagRemove}
              >
                {t('bulkTagRemove')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="destructive"
          size="sm"
          className="text-destructive"
          onClick={onDeleteClick}
        >
          <Trash2 className="size-4" />
          {tc('delete')}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={tc('cancel')}
          onClick={onClear}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
