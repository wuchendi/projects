'use server'

import { cookies } from 'next/headers'
import type { Locale } from './config'
import { defaultLocale, localeCookieName, locales } from './config'

// Locale lives in a cookie (no URL prefix) so it never collides with the
// top-level `[slug]` redirect route.
export async function getUserLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(localeCookieName)?.value
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale
}

export async function setUserLocale(locale: Locale): Promise<void> {
  const store = await cookies()
  store.set(localeCookieName, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
