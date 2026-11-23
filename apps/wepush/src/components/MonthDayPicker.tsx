'use client'

import { Button } from '@cdlab/ui/components/button'
import { Calendar } from '@cdlab/ui/components/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { format, isValid, parse } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'

// Reference year. 2024 is a leap year, so all valid MM-DD pairs (incl. 02-29)
// can be represented. Year is internal only — never surfaced to the caller.
const REFERENCE_YEAR = 2024

interface Props {
  value: string // MM-DD or empty
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function toDate(value: string): Date | undefined {
  if (!value || !/^\d{2}-\d{2}$/.test(value)) return undefined
  const d = parse(`${REFERENCE_YEAR}-${value}`, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

export function MonthDayPicker({
  value,
  onChange,
  placeholder = '选择月日',
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={`justify-start font-normal ${
              selected ? '' : 'text-muted-foreground'
            } ${className ?? ''}`}
          />
        }
      >
        <CalendarIcon className="mr-2 size-4" />
        {selected ? format(selected, 'MM-dd') : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">
          仅记录月日（年份忽略）
        </div>
        <Calendar
          mode="single"
          locale={zhCN}
          selected={selected}
          defaultMonth={selected ?? new Date(REFERENCE_YEAR, 0, 1)}
          startMonth={new Date(REFERENCE_YEAR, 0, 1)}
          endMonth={new Date(REFERENCE_YEAR, 11, 31)}
          captionLayout="dropdown"
          hideNavigation
          onSelect={(d) => {
            onChange(d ? format(d, 'MM-dd') : '')
            if (d) setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
