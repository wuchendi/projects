'use client'

import {
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import * as React from 'react'
import type { DateRange, Locale, Matcher } from 'react-day-picker'
import { Button } from '@cdlab/ui/components/button'
import { Calendar } from '@cdlab/ui/components/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { cn } from '@cdlab/ui/lib/utils'

export interface DateRangePreset {
  label: string
  /** A fixed range, or a factory evaluated when the preset is clicked. */
  range: DateRange | (() => DateRange)
}

export interface DateRangePickerProps {
  /** Controlled selected range. */
  value?: DateRange
  /** Uncontrolled initial range. */
  defaultValue?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  clearable?: boolean
  disabled?: boolean
  /** Earliest selectable date (also used to clamp presets). */
  minDate?: Date
  /** Latest selectable date (also used to clamp presets). */
  maxDate?: Date
  /** Extra disabled matchers passed through to the calendar. */
  disabledDates?: Matcher | Matcher[]
  numberOfMonths?: number
  /** Quick-select presets. Pass `[]` to hide the side panel. */
  presets?: DateRangePreset[]
  /** date-fns locale for calendar rendering and week presets. */
  locale?: Locale
  /** date-fns format string for the trigger label. */
  dateFormat?: string
}

function getDefaultPresets(locale?: Locale): DateRangePreset[] {
  return [
    {
      label: 'Today',
      range: () => {
        const today = new Date()
        return { from: today, to: today }
      },
    },
    {
      label: 'Yesterday',
      range: () => {
        const yesterday = subDays(new Date(), 1)
        return { from: yesterday, to: yesterday }
      },
    },
    {
      label: 'Last 7 days',
      range: () => ({ from: subDays(new Date(), 6), to: new Date() }),
    },
    {
      label: 'Last 30 days',
      range: () => ({ from: subDays(new Date(), 29), to: new Date() }),
    },
    {
      label: 'This week',
      range: () => ({
        from: startOfWeek(new Date(), { locale }),
        to: endOfWeek(new Date(), { locale }),
      }),
    },
    {
      label: 'Last week',
      range: () => {
        const lastWeek = subWeeks(new Date(), 1)
        return {
          from: startOfWeek(lastWeek, { locale }),
          to: endOfWeek(lastWeek, { locale }),
        }
      },
    },
    {
      label: 'This month',
      range: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      }),
    },
    {
      label: 'Last month',
      range: () => {
        const lastMonth = subMonths(new Date(), 1)
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        }
      },
    },
  ]
}

function resolvePresetRange(preset: DateRangePreset): DateRange {
  return typeof preset.range === 'function' ? preset.range() : preset.range
}

function clampDate(date: Date, minDate?: Date, maxDate?: Date) {
  if (minDate && isBefore(date, minDate)) {
    return minDate
  }

  if (maxDate && isAfter(date, maxDate)) {
    return maxDate
  }

  return date
}

function clampDateRange(
  range: DateRange | undefined,
  minDate?: Date,
  maxDate?: Date,
): DateRange | undefined {
  if (!range?.from) {
    return range
  }

  const from = clampDate(range.from, minDate, maxDate)

  if (!range.to) {
    return { from }
  }

  const to = clampDate(range.to, minDate, maxDate)

  if (isAfter(from, to)) {
    return { from: to, to }
  }

  return { from, to }
}

function getDisplayMonth(
  range: DateRange | undefined,
  minDate?: Date,
  maxDate?: Date,
) {
  if (range?.from) {
    return clampDate(range.from, minDate, maxDate)
  }

  if (maxDate) {
    return maxDate
  }

  if (minDate) {
    return minDate
  }

  return new Date()
}

function getSortedDateRange(from: Date, to: Date): DateRange {
  if (isAfter(from, to)) {
    return { from: to, to: from }
  }

  return { from, to }
}

function isSameDateRange(
  left: DateRange | undefined,
  right: DateRange | undefined,
) {
  return (
    left?.from?.getTime() === right?.from?.getTime() &&
    left?.to?.getTime() === right?.to?.getTime()
  )
}

export function DateRangePicker({
  value,
  defaultValue,
  onChange,
  placeholder = 'Pick a date range',
  className,
  clearable = true,
  disabled = false,
  minDate,
  maxDate,
  disabledDates,
  numberOfMonths = 2,
  presets,
  locale,
  dateFormat = 'yyyy-MM-dd',
}: DateRangePickerProps) {
  const isControlled = value !== undefined
  const [open, setOpen] = React.useState(false)
  const [innerDateRange, setInnerDateRange] = React.useState<
    DateRange | undefined
  >(defaultValue)
  // Draft value inside the popover, so hover/partial picks don't leak out early.
  const [draftDateRange, setDraftDateRange] = React.useState<
    DateRange | undefined
  >(defaultValue ?? value)
  // Start of the range being (re)picked; the next click completes it.
  const [rangeStartDate, setRangeStartDate] = React.useState<Date>()
  const [hoverDate, setHoverDate] = React.useState<Date>()
  const [month, setMonth] = React.useState(() =>
    getDisplayMonth(defaultValue ?? value, minDate, maxDate),
  )

  const resolvedPresets = presets ?? getDefaultPresets(locale)
  const dateRange = React.useMemo(
    () =>
      clampDateRange(isControlled ? value : innerDateRange, minDate, maxDate),
    [innerDateRange, isControlled, maxDate, minDate, value],
  )
  const previewDateRange = React.useMemo(() => {
    if (!rangeStartDate || !hoverDate) {
      return draftDateRange
    }

    // Hover is a visual preview only; it never mutates the pending draft.
    return clampDateRange(
      getSortedDateRange(rangeStartDate, hoverDate),
      minDate,
      maxDate,
    )
  }, [draftDateRange, hoverDate, maxDate, minDate, rangeStartDate])
  const isRangePreviewing = Boolean(rangeStartDate && hoverDate)

  const disabledMatchers = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
    ...(disabledDates
      ? Array.isArray(disabledDates)
        ? disabledDates
        : [disabledDates]
      : []),
  ]

  React.useEffect(() => {
    if (!isControlled) {
      return
    }

    setMonth(getDisplayMonth(dateRange, minDate, maxDate))
  }, [dateRange, isControlled, maxDate, minDate])

  React.useEffect(() => {
    if (open) {
      return
    }

    setDraftDateRange(dateRange)
    setRangeStartDate(undefined)
    setHoverDate(undefined)
  }, [dateRange, open])

  const commitDateRange = (range: DateRange | undefined) => {
    const nextRange = clampDateRange(range, minDate, maxDate)

    if (isSameDateRange(nextRange, dateRange)) {
      return
    }

    if (!isControlled) {
      setInnerDateRange(nextRange)
    }
    setMonth(getDisplayMonth(nextRange, minDate, maxDate))
    onChange?.(nextRange)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) {
      return
    }

    if (nextOpen) {
      setDraftDateRange(dateRange)
      setRangeStartDate(undefined)
      setHoverDate(undefined)
      setMonth(getDisplayMonth(dateRange, minDate, maxDate))
      setOpen(true)
      return
    }

    // Closing after only the start was picked cancels this incomplete round.
    const nextRange =
      rangeStartDate && draftDateRange?.from && !draftDateRange.to
        ? dateRange
        : draftDateRange

    commitDateRange(nextRange)
    setDraftDateRange(nextRange)
    setRangeStartDate(undefined)
    setHoverDate(undefined)
    setOpen(false)
  }

  const closeWithRange = (range: DateRange | undefined) => {
    setDraftDateRange(range)
    commitDateRange(range)
    setRangeStartDate(undefined)
    setHoverDate(undefined)
    setOpen(false)
  }

  const handleDayClick = (day: Date) => {
    const clickedDate = clampDate(day, minDate, maxDate)

    if (!rangeStartDate) {
      setDraftDateRange({ from: clickedDate })
      setRangeStartDate(clickedDate)
      setHoverDate(undefined)
      setMonth(getDisplayMonth({ from: clickedDate }, minDate, maxDate))
      return
    }

    const nextRange = clampDateRange(
      getSortedDateRange(rangeStartDate, clickedDate),
      minDate,
      maxDate,
    )

    closeWithRange(nextRange)
  }

  const handleDayMouseEnter = (day: Date) => {
    if (!rangeStartDate) {
      return
    }

    setHoverDate(clampDate(day, minDate, maxDate))
  }

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = clampDateRange(resolvePresetRange(preset), minDate, maxDate)

    if (!range?.from) {
      return
    }

    closeWithRange(range)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isControlled) {
      setInnerDateRange(undefined)
    }
    setDraftDateRange(undefined)
    setRangeStartDate(undefined)
    setHoverDate(undefined)
    setMonth(getDisplayMonth(undefined, minDate, maxDate))
    onChange?.(undefined)
  }

  const getDisplayText = () => {
    if (!dateRange?.from) {
      return placeholder
    }

    if (dateRange.to) {
      return `${format(dateRange.from, dateFormat, { locale })} - ${format(
        dateRange.to,
        dateFormat,
        { locale },
      )}`
    }

    return format(dateRange.from, dateFormat, { locale })
  }

  const showClear = clearable && !disabled && Boolean(dateRange?.from)

  const triggerElement = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(
        'w-[260px] justify-start gap-2 pr-2 text-left font-normal',
        !dateRange?.from && 'text-muted-foreground',
        className,
      )}
    >
      <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{getDisplayText()}</span>
      {showClear && (
        <span
          role="button"
          tabIndex={-1}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={handleClear}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Clear date range"
        >
          <X className="size-3.5" aria-hidden="true" />
        </span>
      )}
    </Button>
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={triggerElement} />
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {resolvedPresets.length > 0 && (
            <div className="flex min-w-[120px] flex-col gap-1 border-r p-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Quick select
              </div>
              {resolvedPresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}

          <div className="p-3">
            <Calendar
              autoFocus
              mode="range"
              month={month}
              onMonthChange={setMonth}
              selected={previewDateRange}
              onDayClick={handleDayClick}
              onDayMouseEnter={handleDayMouseEnter}
              // Range assembly is handled above; keep DayPicker from holding
              // its own stale range.
              onSelect={() => undefined}
              disabled={disabledMatchers}
              classNames={{
                day_button: cn(
                  'transition-none',
                  isRangePreviewing
                    ? 'data-[range-start=true]:bg-muted! data-[range-start=true]:text-foreground! data-[range-start=true]:hover:bg-muted! data-[range-start=true]:hover:text-foreground! data-[range-end=true]:bg-muted! data-[range-end=true]:text-foreground! data-[range-end=true]:hover:bg-muted! data-[range-end=true]:hover:text-foreground!'
                    : 'data-[range-start=true]:hover:bg-primary data-[range-start=true]:hover:text-primary-foreground data-[range-end=true]:hover:bg-primary data-[range-end=true]:hover:text-primary-foreground',
                ),
              }}
              numberOfMonths={numberOfMonths}
              locale={locale}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
