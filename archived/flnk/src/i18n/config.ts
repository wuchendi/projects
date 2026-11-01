export const locales = ['en', 'zh'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
export const localeCookieName = 'NEXT_LOCALE'

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
}
