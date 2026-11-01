import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { NextResponse } from 'next/server'
import * as schema from '@/database/schema'
import { getDb } from '@/lib/data/db'
import { getConfig } from '@/lib/platform/env'
import { logger } from '@/lib/platform/logger'

// One-per-isolate reminder that the console is open to any social account.
let warnedAllowAll = false

// Allow-list gate shared by sign-up (databaseHooks) and requireSession. An
// empty ALLOWED_EMAILS keeps the historical allow-all behavior.
function isEmailAllowed(email: string): boolean {
  const { allowedEmails } = getConfig()
  if (allowedEmails.length === 0) {
    if (!warnedAllowAll) {
      warnedAllowAll = true
      logger.warn(
        'ALLOWED_EMAILS is not set — any Google/GitHub account can sign in and gain full access',
      )
    }
    return true
  }
  return allowedEmails.includes(email.toLowerCase())
}

// Memoized per isolate: the instance can't be built at module top (on
// Cloudflare Workers the D1 binding and process.env vars only exist inside a
// request), but once built it is safe to reuse — getDb() is keyed-cached and
// the social creds are stable per deployment.
let authPromise: ReturnType<typeof buildAuth> | null = null

export async function getAuth() {
  if (!authPromise) {
    authPromise = buildAuth().catch((error) => {
      // Don't cache a failed build (e.g. transient db init error).
      authPromise = null
      throw error
    })
  }
  return authPromise
}

async function buildAuth() {
  const db = await getDb()

  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
  const githubEnabled =
    !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET

  return betterAuth({
    appName: 'flnk',
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    // On Cloudflare Workers the real client IP is forwarded in `CF-Connecting-IP`;
    // better-auth defaults to `X-Forwarded-For` (absent here), so rate limiting
    // would otherwise fall back to a single shared per-path bucket. Point it at
    // CF's trusted header.
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },
    },
    // Social login only — no email/password. First social sign-in auto-creates
    // the user (login == registration).
    socialProviders: {
      ...(googleEnabled && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }),
      ...(githubEnabled && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID as string,
          clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
      }),
    },
    // Block user creation (first social sign-in) for emails outside the
    // allow-list — with login == registration this is the sign-up gate.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isEmailAllowed(user.email)) {
              throw new APIError('FORBIDDEN', {
                message: 'Sign-up is disabled for this email address',
              })
            }
          },
        },
      },
    },
    plugins: [nextCookies()],
  })
}

export interface SessionUser {
  id: string
  email: string
  name: string
}

type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse }

// Session gate for /api/* route handlers. Replaces the old SITE_TOKEN Bearer
// check — a valid better-auth session cookie is required. On success the signed
// -in user is returned so writes can record their author (e.g. links.createdBy).
export async function requireSession(request: Request): Promise<AuthResult> {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      ),
    }
  }
  const user = session.user as SessionUser
  // Defense in depth: sessions created before the allow-list was set (or
  // before it was tightened) must not keep API access.
  if (!isEmailAllowed(user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Access denied: email is not on the allow-list' },
        { status: 403 },
      ),
    }
  }
  return { ok: true, user }
}

// Session gate for the dashboard server layout. Returns the signed-in user only
// when a session exists AND its email passes the SAME allow-list requireSession
// enforces — so the rendered dashboard can't outlive an allow-list tightening.
// Returns null when either check fails (caller redirects to login).
export async function getAllowedSession(
  headers: Headers,
): Promise<SessionUser | null> {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers })
  if (!session) return null
  const user = session.user as SessionUser
  if (!isEmailAllowed(user.email)) return null
  return user
}
