import { TZDate } from '@date-fns/tz'
import { differenceInCalendarDays, format, startOfDay } from 'date-fns'
import { LunarDay } from 'tyme4ts'

export interface FestivalInput {
  name: string
  date: string // MM-DD (interpreted per `isLunar`)
  isLunar?: boolean
}

export interface CustomDateInput {
  keyword: string
  date: string // YYYY-MM-DD
}

export interface BirthdayInfo {
  name: string
  date: string
  diffDay: number
  isLunar: boolean
  targetDate: string // YYYY-MM-DD, solar date of the next occurrence
}

// Cloudflare Workers run in UTC; all "today / current date" derivations must be
// computed against Asia/Shanghai so cron pushes (UTC 23:30 ≈ CST 07:30 next
// day) and on-demand pushes render the same Chinese-calendar date the user
// expects. TZDate carries the time zone through date-fns helpers so the result
// is independent of the worker's system clock.
const TIMEZONE = 'Asia/Shanghai'

function dayInTz(year: number, month: number, day: number): TZDate {
  return new TZDate(year, month - 1, day, TIMEZONE)
}

function solarOccurrence(month: number, day: number, year: number): TZDate {
  return dayInTz(year, month, day)
}

/**
 * Next solar date matching the supplied lunar MM-DD on or after `today`.
 * Searches the current and next lunar year (handles wrap-around at the
 * January boundary). Returns `null` if conversion fails (invalid lunar
 * date — e.g. a 30th day in a 29-day lunar month).
 */
function lunarOccurrence(
  month: number,
  day: number,
  today: TZDate,
): TZDate | null {
  // Lunar new year falls in Jan–Feb of the solar calendar, so we probe the
  // previous and next lunar year too — a "lunar 11月" may map to the current
  // solar year while a "lunar 1月" may fall into the next one.
  const todayYear = today.getFullYear()
  const guesses = [todayYear - 1, todayYear, todayYear + 1]
  for (const year of guesses) {
    try {
      const solar = LunarDay.fromYmd(year, month, day).getSolarDay()
      const d = dayInTz(solar.getYear(), solar.getMonth(), solar.getDay())
      if (differenceInCalendarDays(d, today) >= 0) return d
    } catch {
      // skip invalid input (e.g. day=30 in a 29-day lunar month)
    }
  }
  return null
}

export function sortBirthdayTime(list: FestivalInput[]): BirthdayInfo[] {
  if (!list.length) return []
  const today = startOfDay(TZDate.tz(TIMEZONE))
  const year = today.getFullYear()

  return list
    .map<BirthdayInfo | null>((item) => {
      const [mm, dd] = item.date.split('-').map((s) => Number.parseInt(s, 10))
      if (!mm || !dd) return null

      let target: TZDate | null
      if (item.isLunar) {
        target = lunarOccurrence(mm, dd, today)
      } else {
        target = solarOccurrence(mm, dd, year)
        if (differenceInCalendarDays(target, today) < 0) {
          target = solarOccurrence(mm, dd, year + 1)
        }
      }
      if (!target) return null
      return {
        name: item.name,
        date: item.date,
        diffDay: differenceInCalendarDays(target, today),
        isLunar: !!item.isLunar,
        targetDate: format(target, 'yyyy-MM-dd'),
      }
    })
    .filter((x): x is BirthdayInfo => x !== null)
    .sort((a, b) => a.diffDay - b.diffDay)
}

function formatBirthday(item: BirthdayInfo): string {
  const tag = item.isLunar ? '(农历)' : ''
  const when = `（${item.targetDate}）`
  if (item.diffDay === 0) return `今天是${item.name}${tag}${when}`
  return `距离${item.name}${tag}还有${item.diffDay}天${when}`
}

export function nextBirthdayMessage(
  list: FestivalInput[],
  windowDays = 30,
): string {
  const sorted = sortBirthdayTime(list)
  const next = sorted[0]
  if (!next || next.diffDay > windowDays) return ''
  return formatBirthday(next)
}

/**
 * Sorted upcoming festivals formatted as ready-to-display strings.
 * No window filter — all configured festivals in chronological order.
 * Used to populate the indexed birthday_0..birthday_N template slots.
 */
export function birthdayList(list: FestivalInput[]): string[] {
  return sortBirthdayTime(list).map(formatBirthday)
}

export function calculateSpecialDays(
  list: CustomDateInput[],
): Record<string, number> {
  const out: Record<string, number> = {}
  if (!list.length) return out
  const today = startOfDay(TZDate.tz(TIMEZONE))
  for (const item of list) {
    if (!item.date || !item.keyword) continue
    const [yyyy, mm, dd] = item.date
      .split('-')
      .map((s) => Number.parseInt(s, 10))
    const target = dayInTz(yyyy, mm, dd)
    out[item.keyword] = differenceInCalendarDays(today, target)
  }
  return out
}

export function formatDateCN(d: Date = new Date()): string {
  return format(new TZDate(d, TIMEZONE), 'yyyy年MM月dd日')
}
