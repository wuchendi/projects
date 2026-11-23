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
import type { Matcher } from 'react-day-picker'

interface Props {
  value: string // YYYY-MM-DD or empty
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** ISO YYYY-MM-DD upper bound — typically today for past-only fields */
  max?: string
  /** ISO YYYY-MM-DD lower bound */
  min?: string
  disabled?: boolean
}

function toDate(value: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  className,
  max,
  min,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)
  const maxDate = toDate(max ?? '')
  const minDate = toDate(min ?? '')

  const matchers: Matcher[] = []
  if (maxDate) matchers.push({ after: maxDate })
  if (minDate) matchers.push({ before: minDate })

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
        {selected ? format(selected, 'yyyy-MM-dd') : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={zhCN}
          selected={selected}
          defaultMonth={selected ?? maxDate ?? new Date()}
          captionLayout="dropdown"
          disabled={matchers}
          onSelect={(d) => {
            onChange(d ? format(d, 'yyyy-MM-dd') : '')
            if (d) setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
