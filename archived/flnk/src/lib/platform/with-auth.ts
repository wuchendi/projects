import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import type * as z from 'zod'
import type { SessionUser } from '@/lib/platform/auth'
import { requireSession } from '@/lib/platform/auth'
import { logger } from '@/lib/platform/logger'
import { checkRateLimit, clientIp } from '@/lib/platform/rate-limit'

type CloudflareEnv = ReturnType<typeof getCloudflareContext>['env']

// Reject a request whose declared body is larger than this before it is
// buffered/parsed (M11). Well above any legitimate JSON payload the API takes.
const MAX_BODY_BYTES = 5 * 1024 * 1024

// Everything a withAuth handler needs that the wrapper already resolved: the
// signed-in user, the raw request (for URL/host/ip), and the Cloudflare env.
export interface AuthContext {
  user: SessionUser
  request: Request
  env: CloudflareEnv
}

// Optional per-route limiter applied after the session passes. Mirrors the
// checkRateLimit usage in backup/route.ts.
export interface RateLimitDescriptor {
  bucket: string
  limit: number
  windowSec: number
}

// Typed error a handler can throw to short-circuit with a specific status. The
// top-level catch in withAuth maps it to the standard { error } envelope.
export class ApiError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

// Shared error mapping for every wrapper: a thrown ApiError becomes its status,
// any other throw is logged and returned as a uniform 500 envelope instead of
// Next's default error page.
function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode },
    )
  }
  logger.error('Unhandled API error', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

// Enforce an optional rate limit after the session passes; returns the 429
// envelope when tripped, otherwise null so the caller proceeds.
async function enforceRateLimit(
  env: CloudflareEnv,
  request: Request,
  rateLimit: RateLimitDescriptor | undefined,
): Promise<NextResponse | null> {
  if (!rateLimit) return null
  const tripped = await checkRateLimit(
    env,
    rateLimit.bucket,
    clientIp(request),
    rateLimit.limit,
    rateLimit.windowSec,
  )
  return tripped
    ? NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    : null
}

// Wraps a mutation route handler with the shared session-gate + body-validation
// + error-envelope boilerplate (ARC-03). The handler runs only after the
// session passes and the body validates; a thrown ApiError maps to its status,
// and any other throw is logged and returned as a uniform 500 envelope instead
// of Next's default. Handlers keep returning their own success/business
// responses unchanged.
export function withAuth<T>(
  schema: z.ZodType<T>,
  handler: (data: T, ctx: AuthContext) => Promise<NextResponse>,
  invalidMessage = 'Invalid payload',
): (request: Request) => Promise<NextResponse> {
  return async (request: Request): Promise<NextResponse> => {
    try {
      const auth = await requireSession(request)
      if (!auth.ok) return auth.response

      // M11: reject an oversized body by its declared Content-Length before it
      // is buffered and parsed. A missing/unparseable header (NaN) falls
      // through to the normal parse path.
      if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
        return NextResponse.json(
          { error: 'Payload too large' },
          { status: 413 },
        )
      }

      const parsed = schema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) {
        return NextResponse.json(
          { error: invalidMessage, issues: parsed.error.issues },
          { status: 400 },
        )
      }

      const { env } = getCloudflareContext()
      return await handler(parsed.data, { user: auth.user, request, env })
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

// Session-only variant of withAuth for read/query routes: the same session-gate
// + error-envelope, but no body schema. The handler reads whatever it needs off
// ctx.request itself. An optional rateLimit runs after the session passes.
export function withSession(
  handler: (ctx: AuthContext) => Promise<NextResponse>,
  rateLimit?: RateLimitDescriptor,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request): Promise<NextResponse> => {
    try {
      const auth = await requireSession(request)
      if (!auth.ok) return auth.response

      const { env } = getCloudflareContext()
      const limited = await enforceRateLimit(env, request, rateLimit)
      if (limited) return limited

      return await handler({ user: auth.user, request, env })
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

// Session-gated variant that also validates the URL search params against a zod
// schema (parsed via Object.fromEntries). On failure it returns the same 400
// { error, issues } shape as withAuth's body path.
export function withQuery<T>(
  schema: z.ZodType<T>,
  handler: (query: T, ctx: AuthContext) => Promise<NextResponse>,
  invalidMessage = 'Invalid query',
  rateLimit?: RateLimitDescriptor,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request): Promise<NextResponse> => {
    try {
      const auth = await requireSession(request)
      if (!auth.ok) return auth.response

      const { env } = getCloudflareContext()
      const limited = await enforceRateLimit(env, request, rateLimit)
      if (limited) return limited

      const params = Object.fromEntries(new URL(request.url).searchParams)
      const parsed = schema.safeParse(params)
      if (!parsed.success) {
        return NextResponse.json(
          { error: invalidMessage, issues: parsed.error.issues },
          { status: 400 },
        )
      }

      return await handler(parsed.data, { user: auth.user, request, env })
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}
